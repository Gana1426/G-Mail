import fs from "fs/promises";
import path from "path";
import { createReadStream } from "fs";
import { simpleParser, type ParsedMail } from "mailparser";
import { randomBytes } from "crypto";
import {
  buildMaildirFlags,
  parseMaildirFlags,
  resolveMaildirFolderPath,
  isVirtualFolder,
} from "@mail-portal/lib/folders";
import {
  buildMaildirFilename,
  normalizeMaildirFilename,
  splitMaildirFilename,
} from "@mail-portal/lib/maildir-filename";
import { ensureMaildirStructure } from "@mail-portal/lib/maildir-path";
import { truncate, stripHtml } from "@mail-portal/lib/format";
import {
  messageMatchesSearchFilter,
  type MailMessageSearchFilter,
} from "@mail-portal/lib/mail-search-filter";
import { AppError } from "@/utils/errors";
import type {
  MailFolderId,
  MailMessageDetail,
  MailMessageSummary,
} from "@mail-portal/types/mail";

interface RawMailEntry {
  uid: string;
  filename: string;
  filepath: string;
  folder: MailFolderId;
  mtime: Date;
}

type TrashMetadata = Record<
  string,
  {
    originalFolder: MailFolderId;
    deletedAt: string;
  }
>;

function parseAddressFromHeaderValue(
  value: string | undefined
): { name?: string; address: string } | null {
  if (!value?.trim()) return null;
  const match = value.match(/^(?:"?([^"<>]*)"?\s*)?<([^>]+)>$/);
  if (match) {
    return {
      name: match[1]?.replace(/^"|"$/g, "").trim() || undefined,
      address: match[2].trim(),
    };
  }
  if (value.includes("@")) {
    return { address: value.trim() };
  }
  return null;
}

function parseAddressFromParsed(
  addr: ParsedMail["from"],
  parsed: ParsedMail
): { name?: string; address: string } {
  const first = addr?.value?.[0];
  if (first?.address) {
    return {
      name: first.name ?? undefined,
      address: first.address,
    };
  }

  const fromHeader = parsed.headers?.get("from");
  const headerText =
    typeof fromHeader === "string"
      ? fromHeader
      : fromHeader && "text" in fromHeader
        ? String(fromHeader.text)
        : undefined;
  const fromRaw = parseAddressFromHeaderValue(headerText);
  if (fromRaw?.address) return fromRaw;

  return { address: "" };
}

function parseAddressArray(
  addrs: ParsedMail["to"],
  headerName?: "to" | "cc" | "bcc",
  parsed?: ParsedMail
): Array<{ name?: string; address: string }> {
  const result: Array<{ name?: string; address: string }> = [];

  if (addrs) {
    const list = Array.isArray(addrs) ? addrs : [addrs];
    for (const entry of list) {
      for (const a of entry.value ?? []) {
        if (a?.address) {
          result.push({ name: a.name ?? undefined, address: a.address });
        }
      }
    }
  }

  if (result.length === 0 && headerName && parsed?.headers) {
    const header = parsed.headers.get(headerName);
    const headerText =
      typeof header === "string"
        ? header
        : header && "text" in header
          ? String(header.text)
          : undefined;
    if (headerText) {
      for (const part of headerText.split(",")) {
        const parsedAddr = parseAddressFromHeaderValue(part.trim());
        if (parsedAddr?.address) result.push(parsedAddr);
      }
    }
  }

  return result;
}

function parsedHtmlContent(html: ParsedMail["html"]): string {
  return typeof html === "string" ? html : "";
}

function normalizeReferences(
  references: ParsedMail["references"]
): string[] | undefined {
  if (!references) return undefined;
  return Array.isArray(references) ? references : [references];
}

function wrapMaildirError(operation: string, error: unknown): never {
  const detail = error instanceof Error ? error.message : String(error);
  const code = (error as NodeJS.ErrnoException)?.code;

  if (code === "ENOENT") {
    throw new AppError(
      "Mailbox folder missing. Please contact support or try again.",
      500,
      "MAILBOX_FOLDER_MISSING"
    );
  }

  console.error(`[Maildir] ${operation} failed:`, detail);
  throw new AppError(`Unable to ${operation}.`, 500, "MAILDIR_ERROR");
}

export class MaildirService {
  private getTrashMetadataPath(maildirPath: string): string {
    return path.join(maildirPath, ".mailhost-trash-meta.json");
  }

  private async readTrashMetadata(maildirPath: string): Promise<TrashMetadata> {
    const file = this.getTrashMetadataPath(maildirPath);
    try {
      const raw = await fs.readFile(file, "utf-8");
      const parsed = JSON.parse(raw) as TrashMetadata;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  private async writeTrashMetadata(
    maildirPath: string,
    metadata: TrashMetadata
  ): Promise<void> {
    const file = this.getTrashMetadataPath(maildirPath);
    await fs.writeFile(file, JSON.stringify(metadata, null, 2), "utf-8");
  }

  private async setTrashOrigin(
    maildirPath: string,
    trashUid: string,
    originalFolder: MailFolderId
  ): Promise<void> {
    const metadata = await this.readTrashMetadata(maildirPath);
    metadata[trashUid] = {
      originalFolder,
      deletedAt: new Date().toISOString(),
    };
    await this.writeTrashMetadata(maildirPath, metadata);
  }

  async getTrashOrigin(
    maildirPath: string,
    trashUid: string
  ): Promise<MailFolderId | null> {
    const metadata = await this.readTrashMetadata(maildirPath);
    return metadata[trashUid]?.originalFolder ?? null;
  }

  async clearTrashOrigin(maildirPath: string, trashUid: string): Promise<void> {
    const metadata = await this.readTrashMetadata(maildirPath);
    if (!metadata[trashUid]) return;
    delete metadata[trashUid];
    await this.writeTrashMetadata(maildirPath, metadata);
  }

  private async ensureFolder(maildirPath: string, folder: MailFolderId) {
    await ensureMaildirStructure(maildirPath);
    const folderPath = resolveMaildirFolderPath(maildirPath, folder);
    for (const sub of ["cur", "new", "tmp"]) {
      await fs.mkdir(path.join(folderPath, sub), { recursive: true });
    }
  }

  private async safeRename(src: string, dest: string): Promise<void> {
    const normalizedDest = normalizeMaildirFilename(dest);
    await fs.mkdir(path.dirname(normalizedDest), { recursive: true });

    const attempt = async () => {
      await fs.access(src);
      await fs.rename(src, normalizedDest);
    };

    try {
      await attempt();
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;

      if (code === "ENOENT") {
        await fs.mkdir(path.dirname(src), { recursive: true });
        await fs.mkdir(path.dirname(normalizedDest), { recursive: true });
        try {
          await attempt();
          return;
        } catch (retryError) {
          const retryCode = (retryError as NodeJS.ErrnoException)?.code;
          if (retryCode !== "EXDEV" && retryCode !== "EPERM" && process.platform !== "win32") {
            throw retryError;
          }
        }
      }

      if (code === "EXDEV" || code === "EPERM" || process.platform === "win32" || code === "ENOENT") {
        await fs.copyFile(src, normalizedDest);
        await fs.unlink(src).catch(() => {});
        return;
      }

      throw error;
    }
  }

  private async atomicDeliver(
    folderPath: string,
    targetSubdir: "cur" | "new",
    raw: string,
    flagString: string
  ): Promise<string> {
    const tmpDir = path.join(folderPath, "tmp");
    const targetDir = path.join(folderPath, targetSubdir);
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.mkdir(targetDir, { recursive: true });

    const unique = `${Date.now()}.${process.pid}.${randomBytes(4).toString("hex")}`;
    const tmpFile = path.join(tmpDir, unique);
    const destName = buildMaildirFilename(unique, flagString);
    const destFile = path.join(targetDir, destName);

    await fs.writeFile(tmpFile, raw, "utf-8");
    await this.safeRename(tmpFile, destFile);
    console.info(`[Maildir] Delivered message to ${destFile}`);
    return destName;
  }

  async listMessages(
    maildirPath: string,
    folder: MailFolderId,
    options: {
      page?: number;
      limit?: number;
      query?: string;
      searchFilter?: MailMessageSearchFilter;
    } = {}
  ): Promise<{ messages: MailMessageSummary[]; total: number }> {
    if (isVirtualFolder(folder)) {
      const physicalFolders: MailFolderId[] = [
        "INBOX",
        "SENT",
        "DRAFTS",
        "SPAM",
        "TRASH",
        "ARCHIVE",
      ];
      const all: MailMessageSummary[] = [];
      for (const f of physicalFolders) {
        const result = await this.listMessages(maildirPath, f, {
          limit: 500,
        });
        all.push(...result.messages);
      }
      const filtered = all.filter((m) => {
        if (folder === "STARRED") return m.isStarred;
        if (folder === "IMPORTANT") return m.isImportant;
        return true;
      });
      filtered.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const page = options.page ?? 1;
      const limit = options.limit ?? 25;
      const start = (page - 1) * limit;
      return {
        messages: filtered.slice(start, start + limit),
        total: filtered.length,
      };
    }

    await this.ensureFolder(maildirPath, folder);
    const folderPath = resolveMaildirFolderPath(maildirPath, folder);
    const entries = await this.collectEntries(folderPath, folder);

    entries.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    let summaries: MailMessageSummary[] = [];
    for (const entry of entries) {
      try {
        const { summary, fullText } = await this.parseSummaryWithBody(entry);
        const filter =
          options.searchFilter ??
          (options.query ? { q: options.query } : undefined);
        if (!messageMatchesSearchFilter(summary, fullText, filter)) continue;
        summaries.push(summary);
      } catch {
        // skip corrupt messages
      }
    }

    const total = summaries.length;
    const page = options.page ?? 1;
    const limit = options.limit ?? 25;
    const start = (page - 1) * limit;
    summaries = summaries.slice(start, start + limit);

    return { messages: summaries, total };
  }

  private async collectEntries(
    folderPath: string,
    folder: MailFolderId
  ): Promise<RawMailEntry[]> {
    const entries: RawMailEntry[] = [];
    for (const sub of ["cur", "new"]) {
      const dir = path.join(folderPath, sub);
      let files: string[] = [];
      try {
        files = await fs.readdir(dir);
      } catch {
        continue;
      }
      for (const filename of files) {
        const filepath = path.join(dir, filename);
        const stat = await fs.stat(filepath).catch(() => null);
        if (!stat?.isFile()) continue;
        entries.push({
          uid: `${folder}:${filename}`,
          filename,
          filepath,
          folder,
          mtime: stat.mtime,
        });
      }
    }
    return entries;
  }

  private async parseSummaryWithBody(
    entry: RawMailEntry
  ): Promise<{ summary: MailMessageSummary; fullText: string }> {
    const parsed = await this.parseFile(entry.filepath);
    const flags = parseMaildirFlags(entry.filename);
    const html = parsedHtmlContent(parsed.html);
    const text = parsed.text ?? stripHtml(html);
    const attachmentNames = (parsed.attachments ?? [])
      .map((a) => a.filename ?? "")
      .filter(Boolean)
      .join(" ");
    const fullText = [text, attachmentNames].filter(Boolean).join(" ");
    const summary: MailMessageSummary = {
      uid: entry.uid,
      messageId: parsed.messageId,
      folder: entry.folder,
      from: parseAddressFromParsed(parsed.from, parsed),
      to: parseAddressArray(parsed.to, "to", parsed),
      cc: parseAddressArray(parsed.cc, "cc", parsed),
      subject: parsed.subject ?? "(No subject)",
      preview: truncate(text || parsed.subject || ""),
      date: (parsed.date ?? entry.mtime).toISOString(),
      isRead: flags.isRead,
      isStarred: flags.isStarred,
      isImportant: flags.isImportant,
      hasAttachments: (parsed.attachments?.length ?? 0) > 0,
      attachmentCount: parsed.attachments?.length ?? 0,
      size: parsed.text?.length ?? html.length,
    };
    return { summary, fullText };
  }

  private async parseSummary(entry: RawMailEntry): Promise<MailMessageSummary> {
    const { summary } = await this.parseSummaryWithBody(entry);
    return summary;
  }

  async getMessage(
    maildirPath: string,
    uid: string
  ): Promise<MailMessageDetail | null> {
    const [folder, ...rest] = uid.split(":");
    const filename = rest.join(":");
    if (!folder || !filename) return null;

    const folderPath = resolveMaildirFolderPath(
      maildirPath,
      folder as MailFolderId
    );

    let filepath = path.join(folderPath, "cur", filename);
    try {
      await fs.access(filepath);
    } catch {
      filepath = path.join(folderPath, "new", filename);
      try {
        await fs.access(filepath);
      } catch {
        return null;
      }
    }

    const parsed = await this.parseFile(filepath);
    const flags = parseMaildirFlags(filename);
    const stat = await fs.stat(filepath);
    const html = parsedHtmlContent(parsed.html);
    const text = parsed.text ?? stripHtml(html);

    return {
      uid,
      messageId: parsed.messageId,
      folder: folder as MailFolderId,
      from: parseAddressFromParsed(parsed.from, parsed),
      to: parseAddressArray(parsed.to, "to", parsed),
      cc: parseAddressArray(parsed.cc, "cc", parsed),
      bcc: parseAddressArray(parsed.bcc, "bcc", parsed),
      subject: parsed.subject ?? "(No subject)",
      preview: truncate(text),
      date: (parsed.date ?? stat.mtime).toISOString(),
      isRead: flags.isRead,
      isStarred: flags.isStarred,
      isImportant: flags.isImportant,
      hasAttachments: (parsed.attachments?.length ?? 0) > 0,
      attachmentCount: parsed.attachments?.length ?? 0,
      size: stat.size,
      html: html || undefined,
      text: parsed.text ?? undefined,
      inReplyTo: parsed.inReplyTo,
      references: normalizeReferences(parsed.references),
      attachments: (parsed.attachments ?? []).map((a, i) => ({
        id: `${uid}:att:${i}`,
        filename: a.filename ?? `attachment-${i + 1}`,
        contentType: a.contentType ?? "application/octet-stream",
        size: a.size ?? 0,
      })),
    };
  }

  async markRead(
    maildirPath: string,
    uid: string,
    isRead: boolean
  ): Promise<string> {
    return this.updateFlags(maildirPath, uid, { isRead });
  }

  async markStarred(
    maildirPath: string,
    uid: string,
    isStarred: boolean
  ): Promise<string> {
    return this.updateFlags(maildirPath, uid, { isStarred });
  }

  async moveMessage(
    maildirPath: string,
    uid: string,
    targetFolder: MailFolderId
  ): Promise<string> {
    try {
      const [sourceFolder, ...rest] = uid.split(":");
      const filename = rest.join(":");
      const sourcePath = resolveMaildirFolderPath(
        maildirPath,
        sourceFolder as MailFolderId
      );
      await this.ensureFolder(maildirPath, targetFolder);
      const targetPath = resolveMaildirFolderPath(maildirPath, targetFolder);

      let srcFile = path.join(sourcePath, "cur", filename);
      let inCur = true;
      try {
        await fs.access(srcFile);
      } catch {
        srcFile = path.join(sourcePath, "new", filename);
        inCur = false;
        await fs.access(srcFile);
      }

      const destDir = path.join(targetPath, inCur ? "cur" : "new");
      await fs.mkdir(destDir, { recursive: true });
      const destFile = path.join(destDir, normalizeMaildirFilename(filename));
      await this.safeRename(srcFile, destFile);

      const nextUid = `${targetFolder}:${path.basename(destFile)}`;

      if (targetFolder === "TRASH" && sourceFolder !== "TRASH") {
        await this.setTrashOrigin(
          maildirPath,
          nextUid,
          sourceFolder as MailFolderId
        );
      }

      if (sourceFolder === "TRASH" && targetFolder !== "TRASH") {
        await this.clearTrashOrigin(maildirPath, uid);
      }

      return nextUid;
    } catch (error) {
      wrapMaildirError("move message", error);
    }
  }

  async deleteMessage(
    maildirPath: string,
    uid: string,
    permanent = false
  ): Promise<void> {
    try {
      if (permanent) {
        const [folder, ...rest] = uid.split(":");
        const filename = rest.join(":");
        const folderPath = resolveMaildirFolderPath(
          maildirPath,
          folder as MailFolderId
        );
        for (const sub of ["cur", "new"]) {
          const fp = path.join(folderPath, sub, filename);
          await fs.unlink(fp).catch(() => {});
        }
        if (folder === "TRASH") {
          await this.clearTrashOrigin(maildirPath, uid);
        }
        return;
      }
      await this.moveMessage(maildirPath, uid, "TRASH");
    } catch (error) {
      wrapMaildirError("delete message", error);
    }
  }

  async saveDraft(
    maildirPath: string,
    raw: string,
    existingUid?: string
  ): Promise<string> {
    try {
      await this.ensureFolder(maildirPath, "DRAFTS");
      const folderPath = resolveMaildirFolderPath(maildirPath, "DRAFTS");

      if (existingUid?.startsWith("DRAFTS:")) {
        await this.deleteMessage(maildirPath, existingUid, true);
      }

      const flagStr = buildMaildirFlags({ isRead: false });
      const destName = await this.atomicDeliver(folderPath, "new", raw, flagStr);
      return `DRAFTS:${destName}`;
    } catch (error) {
      wrapMaildirError("save draft", error);
    }
  }

  async deliverToInbox(maildirPath: string, raw: string): Promise<string> {
    try {
      await this.ensureFolder(maildirPath, "INBOX");
      const folderPath = resolveMaildirFolderPath(maildirPath, "INBOX");
      const flagStr = buildMaildirFlags({ isRead: false });
      const destName = await this.atomicDeliver(
        folderPath,
        "new",
        raw,
        flagStr
      );
      return `INBOX:${destName}`;
    } catch (error) {
      wrapMaildirError("deliver to inbox", error);
    }
  }

  async appendMessage(
    maildirPath: string,
    folder: MailFolderId,
    raw: string,
    flags?: { isRead?: boolean; isStarred?: boolean }
  ): Promise<string> {
    try {
      await this.ensureFolder(maildirPath, folder);
      const folderPath = resolveMaildirFolderPath(maildirPath, folder);
      const flagStr = buildMaildirFlags({
        isRead: flags?.isRead ?? true,
        isStarred: flags?.isStarred,
      });
      const destName = await this.atomicDeliver(folderPath, "cur", raw, flagStr);
      return `${folder}:${destName}`;
    } catch (error) {
      wrapMaildirError("save message", error);
    }
  }

  async getAttachment(
    maildirPath: string,
    uid: string,
    attachmentId: string
  ): Promise<{ filename: string; contentType: string; content: Buffer } | null> {
    const message = await this.getMessage(maildirPath, uid);
    if (!message) return null;

    const filePath = await this.resolveFilePath(maildirPath, uid);
    if (!filePath) return null;

    const parsed = await this.parseFile(filePath);
    const index = parseInt(attachmentId.split(":att:")[1] ?? "-1", 10);
    const attachment = parsed.attachments?.[index];
    if (!attachment?.content) return null;

    return {
      filename: attachment.filename ?? "attachment",
      contentType: attachment.contentType ?? "application/octet-stream",
      content: Buffer.isBuffer(attachment.content)
        ? attachment.content
        : Buffer.from(attachment.content),
    };
  }

  async getRawMessage(maildirPath: string, uid: string): Promise<Buffer | null> {
    const fp = await this.resolveFilePath(maildirPath, uid);
    if (!fp) return null;
    return fs.readFile(fp);
  }

  async countUnread(maildirPath: string): Promise<number> {
    const { messages } = await this.listMessages(maildirPath, "INBOX", {
      limit: 1000,
    });
    return messages.filter((m) => !m.isRead).length;
  }

  async getFolderStats(
    maildirPath: string,
    folder: MailFolderId
  ): Promise<{ total: number; unread: number }> {
    const { messages, total } = await this.listMessages(maildirPath, folder, {
      limit: 1000,
    });
    return {
      total,
      unread: messages.filter((m) => !m.isRead).length,
    };
  }

  async calculateStorageUsed(maildirPath: string): Promise<bigint> {
    let total = BigInt(0);
    async function walk(dir: string) {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.isFile()) {
          const stat = await fs.stat(full);
          total += BigInt(stat.size);
        }
      }
    }
    await walk(maildirPath);
    return total;
  }

  private async resolveFilePath(
    maildirPath: string,
    uid: string
  ): Promise<string | null> {
    const [folder, ...rest] = uid.split(":");
    const filename = rest.join(":");
    const folderPath = resolveMaildirFolderPath(
      maildirPath,
      folder as MailFolderId
    );
    for (const sub of ["cur", "new"]) {
      const fp = path.join(folderPath, sub, filename);
      try {
        await fs.access(fp);
        return fp;
      } catch {
        continue;
      }
    }
    return null;
  }

  private async updateFlags(
    maildirPath: string,
    uid: string,
    updates: { isRead?: boolean; isStarred?: boolean; isImportant?: boolean }
  ): Promise<string> {
    try {
      const [folder, ...rest] = uid.split(":");
      const filename = rest.join(":");
      const folderPath = resolveMaildirFolderPath(
        maildirPath,
        folder as MailFolderId
      );

      let srcFile = path.join(folderPath, "cur", filename);
      let inCur = true;
      try {
        await fs.access(srcFile);
      } catch {
        srcFile = path.join(folderPath, "new", filename);
        inCur = false;
      }

      const current = parseMaildirFlags(filename);
      const { baseName } = splitMaildirFilename(filename);
      const newFlagString = buildMaildirFlags({
        isRead: updates.isRead ?? current.isRead,
        isStarred: updates.isStarred ?? current.isStarred,
        isImportant: updates.isImportant ?? current.isImportant,
      });
      const newFilename = buildMaildirFilename(baseName, newFlagString);

      const markReadFromNew = updates.isRead === true && !inCur;
      const targetSubdir = markReadFromNew ? "cur" : inCur ? "cur" : "new";
      const destDir = path.join(folderPath, targetSubdir);
      await fs.mkdir(destDir, { recursive: true });
      const destFile = path.join(destDir, normalizeMaildirFilename(newFilename));

      if (path.resolve(srcFile) !== path.resolve(destFile)) {
        await this.safeRename(srcFile, destFile);
      }

      return `${folder}:${path.basename(destFile)}`;
    } catch (error) {
      wrapMaildirError("update message", error);
    }
  }

  private parseFile(filepath: string): Promise<ParsedMail> {
    return new Promise((resolve, reject) => {
      const stream = createReadStream(filepath);
      simpleParser(stream, (err, parsed) => {
        if (err) reject(err);
        else resolve(parsed);
      });
    });
  }
}

export const maildirService = new MaildirService();
