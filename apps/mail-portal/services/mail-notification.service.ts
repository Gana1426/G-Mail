import { notificationRepository } from "@/repositories/mail.repository";
import { mailPortalMailboxRepository } from "@mail-portal/repositories/mail.repository";
import type { MailSessionContext } from "@mail-portal/types/mail";
import type { NotificationType } from "@prisma/client";

export type MailNotificationKind =
  | "mail_received"
  | "mail_sent"
  | "draft_saved"
  | "draft_deleted"
  | "mail_deleted"
  | "spam_detected"
  | "mailbox_full"
  | "storage_warning"
  | "login_success"
  | "login_failure";

interface CreateNotificationInput {
  mailboxId: string;
  kind: MailNotificationKind;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
  metadata?: Record<string, unknown>;
}

export class MailNotificationService {
  private async resolveUserId(mailboxId: string): Promise<string | null> {
    const mailbox = await mailPortalMailboxRepository.findById(mailboxId);
    return mailbox?.userId ?? null;
  }

  async create(input: CreateNotificationInput) {
    const userId = await this.resolveUserId(input.mailboxId);
    if (!userId) return null;

    const duplicate = await notificationRepository.findRecentDuplicate(
      userId,
      input.title,
      input.message,
      input.link,
      new Date(Date.now() - 2 * 60 * 1000)
    );
    if (duplicate) {
      return duplicate;
    }

    return notificationRepository.create({
      user: { connect: { id: userId } },
      type: input.type ?? "INFO",
      title: input.title,
      message: input.message,
      link: input.link,
      metadata: {
        kind: input.kind,
        mailboxId: input.mailboxId,
        ...input.metadata,
      },
    });
  }

  async listForSession(session: MailSessionContext, unreadOnly = false) {
    const userId = await this.resolveUserId(session.mailboxId);
    if (!userId) return [];
    const all = await notificationRepository.findByUser(userId, unreadOnly);
    return all.filter((n) => {
      const meta = n.metadata as { kind?: string } | null;
      return meta?.kind === "mail_received";
    });
  }

  async unreadCount(session: MailSessionContext) {
    const notifications = await this.listForSession(session, true);
    return notifications.length;
  }

  async markRead(session: MailSessionContext, id: string) {
    const userId = await this.resolveUserId(session.mailboxId);
    if (!userId) return;
    await notificationRepository.markReadForUser(id, userId);
  }

  async markAllRead(session: MailSessionContext) {
    const userId = await this.resolveUserId(session.mailboxId);
    if (!userId) return;
    await notificationRepository.markAllRead(userId);
  }

  async delete(session: MailSessionContext, id: string) {
    const userId = await this.resolveUserId(session.mailboxId);
    if (!userId) return;
    await notificationRepository.deleteForUser(id, userId);
  }

  async notifyMailSent(_session: MailSessionContext, _subject: string) {
    return null;
  }

  async notifyDraftSaved(_session: MailSessionContext, _subject: string) {
    return null;
  }

  async notifyDraftDeleted(_session: MailSessionContext) {
    return null;
  }

  async notifyMailDeleted(_session: MailSessionContext, _count: number) {
    return null;
  }

  async notifyMailReceived(
    mailboxId: string,
    senderEmail: string,
    subject: string,
    options?: {
      senderName?: string;
      uid?: string;
      receivedAt?: string;
    }
  ) {
    const senderName = options?.senderName?.trim() || senderEmail;
    const uid = options?.uid;
    const link = uid
      ? `/mail-portal/mail/inbox?uid=${encodeURIComponent(uid)}`
      : "/mail-portal/mail/inbox";

    return this.create({
      mailboxId,
      kind: "mail_received",
      type: "INFO",
      title: senderName,
      message: subject || "(No subject)",
      link,
      metadata: {
        senderName,
        senderEmail,
        subject: subject || "(No subject)",
        receivedAt: options?.receivedAt ?? new Date().toISOString(),
        uid,
        folder: "INBOX",
      },
    });
  }

  async notifySpam(_session: MailSessionContext, _count: number) {
    return null;
  }

  async notifyStorageWarning(session: MailSessionContext, percent: number) {
    return this.create({
      mailboxId: session.mailboxId,
      kind: percent >= 95 ? "mailbox_full" : "storage_warning",
      type: "WARNING",
      title: percent >= 95 ? "Mailbox almost full" : "Storage warning",
      message: `Your mailbox is ${percent}% full.`,
      link: "/mail-portal/profile",
    });
  }

  async notifyLoginSuccess(_mailboxId: string, _email: string) {
    return null;
  }

  async notifyLoginFailure(_mailboxId: string | null, _email: string) {
    return null;
  }

  async checkStorageAndNotify(session: MailSessionContext, percent: number) {
    if (percent < 80) return;
    await this.notifyStorageWarning(session, percent);
  }
}

export const mailNotificationService = new MailNotificationService();
