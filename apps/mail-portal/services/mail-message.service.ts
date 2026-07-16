import { maildirService } from "@mail-portal/services/maildir.service";
import { imapService } from "@mail-portal/services/imap.service";
import { mailSendService } from "@mail-portal/services/mail-send.service";
import { mailPortalMailboxRepository } from "@mail-portal/repositories/mail.repository";
import { mailProvisionService } from "@/services/mail-provision.service";
import type {
  MailDashboardStats,
  MailFolderId,
  MailFolderInfo,
  MailMessageDetail,
  MailMessageSummary,
  MailSearchQuery,
  MailSessionContext,
  SendMailInput,
} from "@mail-portal/types/mail";
import {
  getFolderLabel,
  listPhysicalFolders,
  listSidebarFolders,
} from "@mail-portal/lib/folders";
import { config } from "@/config";
import { NotFoundError } from "@/utils/errors";

export class MailMessageService {
  private resolvePath(session: MailSessionContext): string {
    if (
      session.maildirPath.startsWith("/") ||
      /^[A-Za-z]:/.test(session.maildirPath)
    ) {
      return session.maildirPath;
    }
    const parts = session.email.split("@");
    return mailProvisionService.getMaildirPath(parts[1], parts[0]);
  }

  async getDashboard(session: MailSessionContext): Promise<MailDashboardStats> {
    const maildirPath = this.resolvePath(session);
    const mailbox = await mailPortalMailboxRepository.findById(session.mailboxId);

    const folders: MailFolderInfo[] = [];
    for (const folder of listSidebarFolders()) {
      const stats = await maildirService.getFolderStats(maildirPath, folder);
      folders.push({
        id: folder,
        name: getFolderLabel(folder),
        path: folder,
        total: stats.total,
        unread: stats.unread,
        selectable: !["STARRED", "IMPORTANT"].includes(folder),
      });
    }

    const unreadCount = folders.find((f) => f.id === "INBOX")?.unread ?? 0;
    const { messages: recentEmails } = await maildirService.listMessages(
      maildirPath,
      "INBOX",
      { limit: 8 }
    );

    const usedBytes =
      mailbox?.usedBytes ??
      (await maildirService.calculateStorageUsed(maildirPath));
    const quotaBytes = mailbox?.quotaBytes ?? BigInt(5368709120);
    const storagePercent =
      quotaBytes > BigInt(0)
        ? Number((usedBytes * BigInt(100)) / quotaBytes)
        : 0;

    return {
      unreadCount,
      storageUsed: usedBytes.toString(),
      storageQuota: quotaBytes.toString(),
      storagePercent,
      folders,
      recentEmails,
    };
  }

  async listInbox(
    session: MailSessionContext,
    folder: MailFolderId,
    options: { page?: number; limit?: number; q?: string }
  ): Promise<{ messages: MailMessageSummary[]; total: number; page: number; totalPages: number }> {
    const maildirPath = this.resolvePath(session);

    const imapResult = config.mail.imapEnabled
      ? await imapService.listMessages(
          session.email,
          session.password,
          folder,
          options
        )
      : null;

    let result;
    if (imapResult && !options.q) {
      result = imapResult;
    } else {
      result = await maildirService.listMessages(maildirPath, folder, options);
    }

    const limit = options.limit ?? 25;
    const page = options.page ?? 1;
    const totalPages = Math.max(1, Math.ceil(result.total / limit));

    return {
      messages: result.messages,
      total: result.total,
      page,
      totalPages,
    };
  }

  async getMessage(
    session: MailSessionContext,
    uid: string
  ): Promise<MailMessageDetail> {
    const maildirPath = this.resolvePath(session);
    const message = await maildirService.getMessage(maildirPath, uid);
    if (!message) throw new NotFoundError("Message not found");

    if (!message.isRead) {
      const newUid = await maildirService.markRead(maildirPath, uid, true);
      message.uid = newUid;
      message.isRead = true;
    }

    return message;
  }

  async performAction(
    session: MailSessionContext,
    action: string,
    uids: string[],
    targetFolder?: MailFolderId
  ): Promise<void> {
    const maildirPath = this.resolvePath(session);

    for (const uid of uids) {
      switch (action) {
        case "markRead":
          await maildirService.markRead(maildirPath, uid, true);
          break;
        case "markUnread":
          await maildirService.markRead(maildirPath, uid, false);
          break;
        case "star":
          await maildirService.markStarred(maildirPath, uid, true);
          break;
        case "unstar":
          await maildirService.markStarred(maildirPath, uid, false);
          break;
        case "delete":
          await maildirService.deleteMessage(maildirPath, uid, false);
          break;
        case "deletePermanent":
          await maildirService.deleteMessage(maildirPath, uid, true);
          break;
        case "archive":
          await maildirService.moveMessage(maildirPath, uid, "ARCHIVE");
          break;
        case "spam":
          await maildirService.moveMessage(maildirPath, uid, "SPAM");
          break;
        case "notSpam":
          await maildirService.moveMessage(maildirPath, uid, "INBOX");
          break;
        case "restore": {
          let restoreFolder = targetFolder;
          if (!restoreFolder) {
            restoreFolder =
              (await maildirService.getTrashOrigin(maildirPath, uid)) ?? "INBOX";
          }
          await maildirService.moveMessage(maildirPath, uid, restoreFolder);
          break;
        }
        case "move":
          if (targetFolder) {
            await maildirService.moveMessage(maildirPath, uid, targetFolder);
          }
          break;
      }
    }
  }

  async reply(
    session: MailSessionContext,
    uid: string,
    input: SendMailInput,
    replyAll = false
  ) {
    const original = await this.getMessage(session, uid);
    const excludeAddress = session.email.toLowerCase();
    const replyAllTo = [
      original.from.address,
      ...original.to.map((t) => t.address),
    ].filter((e) => e.toLowerCase() !== excludeAddress);
    const to = replyAll ? replyAllTo : [original.from.address];

    return mailSendService.send(session, {
      ...input,
      to: [...new Set(to)],
      inReplyTo: original.messageId,
      references: [
        ...(original.references ?? []),
        ...(original.messageId ? [original.messageId] : []),
      ],
      subject: input.subject.startsWith("Re:")
        ? input.subject
        : `Re: ${original.subject}`,
    });
  }

  async forward(session: MailSessionContext, uid: string, input: SendMailInput) {
    const original = await this.getMessage(session, uid);
    const maildirPath = this.resolvePath(session);
    const raw = await maildirService.getRawMessage(maildirPath, uid);

    const forwardHtml = `${input.html}<br/><br/>---------- Forwarded message ----------<br/>${original.html ?? original.text ?? ""}`;

    return mailSendService.send(session, {
      ...input,
      html: forwardHtml,
      subject: input.subject.startsWith("Fwd:")
        ? input.subject
        : `Fwd: ${original.subject}`,
    });
  }

  async search(
    session: MailSessionContext,
    query: MailSearchQuery
  ): Promise<{ messages: MailMessageSummary[]; total: number }> {
    const maildirPath = this.resolvePath(session);
    const searchFilter = {
      q: query.q,
      from: query.from,
      to: query.to,
      subject: query.subject,
      body: query.body,
    };
    const hasTextFilter = Object.values(searchFilter).some(Boolean);

    const foldersToSearch: MailFolderId[] = query.folder
      ? [query.folder]
      : listPhysicalFolders();

    let allMessages: MailMessageSummary[] = [];
    for (const f of foldersToSearch) {
      const { messages } = await maildirService.listMessages(maildirPath, f, {
        limit: hasTextFilter ? 1000 : 500,
        searchFilter: hasTextFilter ? searchFilter : undefined,
      });
      allMessages.push(...messages);
    }

    if (query.hasAttachment) {
      allMessages = allMessages.filter((m) => m.hasAttachments);
    }

    if (query.isRead) {
      allMessages = allMessages.filter((m) => m.isRead);
    }

    if (query.isUnread) {
      allMessages = allMessages.filter((m) => !m.isRead);
    }

    if (query.isStarred) {
      allMessages = allMessages.filter((m) => m.isStarred);
    }

    if (query.dateFrom) {
      const from = new Date(query.dateFrom).getTime();
      allMessages = allMessages.filter(
        (m) => new Date(m.date).getTime() >= from
      );
    }

    if (query.dateTo) {
      const to = new Date(query.dateTo).getTime();
      allMessages = allMessages.filter(
        (m) => new Date(m.date).getTime() <= to
      );
    }

    allMessages.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const start = (page - 1) * limit;

    return {
      messages: allMessages.slice(start, start + limit),
      total: allMessages.length,
    };
  }

  async getFolders(session: MailSessionContext): Promise<MailFolderInfo[]> {
    const dashboard = await this.getDashboard(session);
    return dashboard.folders;
  }

  async downloadEml(session: MailSessionContext, uid: string): Promise<Buffer | null> {
    const maildirPath = this.resolvePath(session);
    return maildirService.getRawMessage(maildirPath, uid);
  }

  async getAttachment(
    session: MailSessionContext,
    uid: string,
    attachmentId: string
  ) {
    const maildirPath = this.resolvePath(session);
    return maildirService.getAttachment(maildirPath, uid, attachmentId);
  }
}

export const mailMessageService = new MailMessageService();
