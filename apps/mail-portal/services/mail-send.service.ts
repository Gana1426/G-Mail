import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import { config } from "@/config";
import type { MailSessionContext, SendMailInput } from "@mail-portal/types/mail";
import { AppError, ValidationError } from "@/utils/errors";
import {
  buildRawMessage,
  formatFromAddress,
} from "@mail-portal/lib/rfc-message";
import { resolveSessionMaildirPath } from "@mail-portal/lib/maildir-path";
import { localMailDeliveryService } from "@mail-portal/services/local-mail-delivery.service";
import { maildirService } from "@mail-portal/services/maildir.service";
import { mailNotificationService } from "@mail-portal/services/mail-notification.service";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class MailSendService {
  private validateEmails(addresses: string[]): void {
    for (const addr of addresses) {
      const trimmed = addr.trim();
      if (!trimmed) continue;
      if (!EMAIL_RE.test(trimmed)) {
        throw new ValidationError(`Invalid email address: ${trimmed}`);
      }
    }
  }

  validateRecipients(input: SendMailInput): void {
    if (!input.to.length) {
      throw new ValidationError("At least one recipient is required");
    }
    if (!input.html?.trim() && !input.text?.trim()) {
      throw new ValidationError("Message body is required");
    }
    this.validateEmails([
      ...input.to,
      ...(input.cc ?? []),
      ...(input.bcc ?? []),
    ]);
  }

  validateDraft(input: Partial<SendMailInput>): void {
    this.validateEmails([
      ...(input.to ?? []),
      ...(input.cc ?? []),
      ...(input.bcc ?? []),
    ]);

    const hasContent =
      (input.to?.length ?? 0) > 0 ||
      (input.subject?.trim().length ?? 0) > 0 ||
      (input.html?.trim().length ?? 0) > 0 ||
      (input.text?.trim().length ?? 0) > 0;

    if (!hasContent) {
      throw new ValidationError(
        "Add a recipient, subject, or message body to save a draft"
      );
    }
  }

  async send(
    session: MailSessionContext,
    input: SendMailInput & { draftUid?: string }
  ): Promise<{ messageId: string; sentUid: string }> {
    this.validateRecipients(input);

    const maildirPath = resolveSessionMaildirPath(session);
    const from = formatFromAddress(session.displayName, session.email);
    const domain = session.email.split("@")[1];
    const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@${domain}>`;

    const allRecipients = [
      ...input.to,
      ...(input.cc ?? []),
      ...(input.bcc ?? []),
    ];

    const localMailboxChecks = await Promise.all(
      allRecipients.map(async (email) => ({
        email: normalizeEmail(email),
        local: await localMailDeliveryService.resolveLocalMailbox(email),
      }))
    );

    const localEmails = new Set(
      localMailboxChecks.filter((r) => r.local).map((r) => r.email)
    );

    const externalTo = input.to.filter(
      (e) => !localEmails.has(normalizeEmail(e))
    );
    const externalCc = (input.cc ?? []).filter(
      (e) => !localEmails.has(normalizeEmail(e))
    );
    const externalBcc = (input.bcc ?? []).filter(
      (e) => !localEmails.has(normalizeEmail(e))
    );
    const hasExternal =
      externalTo.length > 0 || externalCc.length > 0 || externalBcc.length > 0;

    if (hasExternal && !config.mail.smtpEnabled) {
      throw new AppError(
        "Unable to send to external recipients. Mail server relay is not enabled.",
        503,
        "MAIL_SMTP_DISABLED"
      );
    }

    const deliveryResults = await localMailDeliveryService.deliverToRecipients({
      displayName: session.displayName,
      senderEmail: session.email,
      input,
      messageId,
      recipients: allRecipients.filter((e) =>
        localEmails.has(normalizeEmail(e))
      ),
    });

    const deliveredLocally = new Set(
      deliveryResults.filter((r) => r.success).map((r) => r.email)
    );

    const failedLocalTo = input.to
      .map(normalizeEmail)
      .filter((e) => localEmails.has(e) && !deliveredLocally.has(e));

    if (failedLocalTo.length > 0) {
      throw new AppError(
        `Unable to deliver to ${failedLocalTo.join(", ")}.`,
        503,
        "MAIL_DELIVERY_FAILED"
      );
    }

    if (hasExternal) {
      const mailOptions: Mail.Options = {
        from,
        to: externalTo.join(", "),
        cc: externalCc.length ? externalCc.join(", ") : undefined,
        bcc: externalBcc.length ? externalBcc.join(", ") : undefined,
        subject: input.subject || "(No subject)",
        html: input.html,
        text: input.text,
        messageId,
        inReplyTo: input.inReplyTo,
        references: input.references?.join(" "),
        priority: input.priority === "high" ? "high" : "normal",
        headers: {
          "Return-Path": `<${session.email}>`,
          Sender: from,
          "Reply-To": session.email,
          ...(input.requestReadReceipt
            ? { "Disposition-Notification-To": session.email }
            : {}),
        },
        attachments: input.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content, "base64"),
          contentType: a.contentType,
        })),
      };

      const transporter = nodemailer.createTransport({
        host: config.mail.hostname,
        port: config.mail.smtpPort,
        secure: config.mail.smtpPort === 465,
        auth: {
          user: session.email,
          pass: session.password,
        },
        tls: { rejectUnauthorized: config.app.env === "production" },
      });

      try {
        await transporter.sendMail(mailOptions);
        console.info(
          `[Mail] SMTP delivery succeeded: ${session.email} -> ${[...externalTo, ...externalCc, ...externalBcc].join(", ")}`
        );
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "SMTP connection failed";
        const unreachable = /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ESOCKET/i.test(
          detail
        );
        console.error(
          `[Mail] SMTP delivery failed: ${session.email}:`,
          detail
        );
        throw new AppError(
          unreachable
            ? "Unable to send email. Mail server is unreachable."
            : "Unable to send email.",
          503,
          "MAIL_SEND_FAILED"
        );
      }
    } else if (!config.mail.smtpEnabled) {
      console.info(
        `[Mail] Local delivery complete for ${deliveredLocally.size} recipient(s)`
      );
    }

    const sentRaw = buildRawMessage({
      from,
      senderEmail: session.email,
      input,
      messageId,
      includeBcc: true,
    });

    try {
      const sentUid = await maildirService.appendMessage(
        maildirPath,
        "SENT",
        sentRaw,
        { isRead: true }
      );

      if (input.draftUid?.startsWith("DRAFTS:")) {
        await maildirService.deleteMessage(maildirPath, input.draftUid, true);
      }

      void mailNotificationService.notifyMailSent(
        session,
        input.subject || "(No subject)"
      );

      return { messageId, sentUid };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Unable to send email.", 500, "MAIL_SEND_FAILED");
    }
  }

  async saveDraft(
    session: MailSessionContext,
    input: Partial<SendMailInput> & { draftUid?: string }
  ): Promise<string> {
    this.validateDraft(input);

    const maildirPath = resolveSessionMaildirPath(session);
    const from = formatFromAddress(session.displayName, session.email);

    const draftInput: SendMailInput = {
      to: input.to ?? [],
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject ?? "",
      html: input.html ?? "",
      text: input.text,
      attachments: input.attachments,
    };

    const messageId = `<draft.${Date.now()}@${session.email.split("@")[1]}>`;
    const raw = buildRawMessage({
      from,
      senderEmail: session.email,
      input: draftInput,
      messageId,
      includeBcc: true,
    });

    try {
      const uid = await maildirService.saveDraft(
        maildirPath,
        raw,
        input.draftUid
      );
      void mailNotificationService.notifyDraftSaved(
        session,
        input.subject ?? ""
      );
      return uid;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to save draft.", 500, "DRAFT_SAVE_FAILED");
    }
  }
}

export const mailSendService = new MailSendService();
