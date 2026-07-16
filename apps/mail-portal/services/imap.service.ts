import { ImapFlow } from "imapflow";
import { config } from "@/config";
import type { MailFolderId, MailMessageSummary } from "@mail-portal/types/mail";
import { truncate } from "@mail-portal/lib/format";
import { getFolderLabel } from "@mail-portal/lib/folders";

const IMAP_FOLDER_MAP: Record<MailFolderId, string> = {
  INBOX: "INBOX",
  SENT: "Sent",
  DRAFTS: "Drafts",
  SPAM: "Junk",
  TRASH: "Trash",
  ARCHIVE: "Archive",
  STARRED: "INBOX",
  IMPORTANT: "INBOX",
  OUTBOX: "Outbox",
};

export class ImapService {
  private createClient(email: string, password: string) {
    return new ImapFlow({
      host: config.mail.hostname,
      port: config.mail.imapPort,
      secure: config.mail.imapPort === 993,
      auth: { user: email, pass: password },
      logger: false,
      tls: { rejectUnauthorized: config.app.env === "production" },
    });
  }

  async testConnection(email: string, password: string): Promise<boolean> {
    const client = this.createClient(email, password);
    try {
      await client.connect();
      await client.logout();
      return true;
    } catch {
      return false;
    }
  }

  async listMessages(
    email: string,
    password: string,
    folder: MailFolderId,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ messages: MailMessageSummary[]; total: number } | null> {
    const client = this.createClient(email, password);
    const imapFolder = IMAP_FOLDER_MAP[folder] ?? "INBOX";
    const page = options.page ?? 1;
    const limit = options.limit ?? 25;

    try {
      await client.connect();
      const lock = await client.getMailboxLock(imapFolder);
      try {
        const mailbox = client.mailbox;
        const total = mailbox ? mailbox.exists : 0;
        if (total === 0) return { messages: [], total: 0 };

        const start = Math.max(1, total - page * limit + 1);
        const end = Math.max(1, total - (page - 1) * limit);
        const messages: MailMessageSummary[] = [];

        for await (const msg of client.fetch(`${start}:${end}`, {
          envelope: true,
          flags: true,
          bodyStructure: true,
          source: { start: 0, maxLength: 512 },
        })) {
          const env = msg.envelope;
          const fromAddr = env?.from?.[0];
          messages.push({
            uid: `${folder}:${msg.uid}`,
            messageId: env?.messageId ?? undefined,
            folder,
            from: {
              name: fromAddr?.name ?? undefined,
              address: fromAddr?.address ?? "",
            },
            to: (env?.to ?? []).map((a) => ({
              name: a.name ?? undefined,
              address: a.address ?? "",
            })),
            subject: env?.subject ?? "(No subject)",
            preview: truncate(msg.source?.toString() ?? ""),
            date: (env?.date ?? new Date()).toISOString(),
            isRead: msg.flags?.has("\\Seen") ?? false,
            isStarred: msg.flags?.has("\\Flagged") ?? false,
            isImportant: msg.flags?.has("\\Important") ?? false,
            hasAttachments: this.hasAttachments(msg.bodyStructure),
            attachmentCount: 0,
            size: msg.size ?? 0,
          });
        }

        messages.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        if (folder === "STARRED") {
          const starred = messages.filter((m) => m.isStarred);
          return { messages: starred, total: starred.length };
        }

        return { messages, total };
      } finally {
        lock.release();
      }
    } catch {
      return null;
    } finally {
      try {
        await client.logout();
      } catch {
        // ignore
      }
    }
  }

  async getFolderCounts(
    email: string,
    password: string
  ): Promise<Array<{ folder: MailFolderId; total: number; unread: number }> | null> {
    const client = this.createClient(email, password);
    const folders: MailFolderId[] = [
      "INBOX",
      "SENT",
      "DRAFTS",
      "SPAM",
      "TRASH",
      "ARCHIVE",
    ];

    try {
      await client.connect();
      const results: Array<{ folder: MailFolderId; total: number; unread: number }> = [];

      for (const folder of folders) {
        const imapFolder = IMAP_FOLDER_MAP[folder];
        try {
          const status = await client.status(imapFolder, {
            messages: true,
            unseen: true,
          });
          results.push({
            folder,
            total: status.messages ?? 0,
            unread: status.unseen ?? 0,
          });
        } catch {
          results.push({ folder, total: 0, unread: 0 });
        }
      }

      return results;
    } catch {
      return null;
    } finally {
      try {
        await client.logout();
      } catch {
        // ignore
      }
    }
  }

  private hasAttachments(structure: unknown): boolean {
    if (!structure || typeof structure !== "object") return false;
    const s = structure as { disposition?: string; childNodes?: unknown[] };
    if (s.disposition === "attachment") return true;
    return (s.childNodes ?? []).some((c) => this.hasAttachments(c));
  }
}

export const imapService = new ImapService();

export function folderDisplayName(folder: MailFolderId): string {
  return getFolderLabel(folder);
}
