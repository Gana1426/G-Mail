import fs from "fs/promises";
import { mailProvisionService } from "@/services/mail-provision.service";
import { ensureMaildirStructure } from "@mail-portal/lib/maildir-path";
import {
  buildRawMessage,
  formatFromAddress,
} from "@mail-portal/lib/rfc-message";
import { mailPortalMailboxRepository } from "@mail-portal/repositories/mail.repository";
import { maildirService } from "@mail-portal/services/maildir.service";
import { mailNotificationService } from "@mail-portal/services/mail-notification.service";
import type { SendMailInput } from "@mail-portal/types/mail";

export interface LocalMailboxInfo {
  email: string;
  maildirPath: string;
}

export interface LocalDeliveryResult {
  email: string;
  success: boolean;
  error?: string;
}

export class LocalMailDeliveryService {
  async resolveLocalMailbox(email: string): Promise<LocalMailboxInfo | null> {
    const normalized = email.trim().toLowerCase();
    const mailbox = await mailPortalMailboxRepository.findByEmail(normalized);
    if (!mailbox || mailbox.status !== "ACTIVE") {
      return null;
    }

    const maildirPath =
      mailbox.maildirPath ??
      mailProvisionService.getMaildirPath(
        mailbox.domain.name,
        mailbox.localPart
      );

    await ensureMaildirStructure(maildirPath);

    try {
      await fs.access(maildirPath);
    } catch {
      console.error(
        `[Mail] Recipient maildir missing after provisioning: ${maildirPath}`
      );
      return null;
    }

    return { email: normalized, maildirPath };
  }

  async deliverToRecipients(params: {
    displayName: string | null;
    senderEmail: string;
    input: SendMailInput;
    messageId: string;
    recipients: string[];
  }): Promise<LocalDeliveryResult[]> {
    const from = formatFromAddress(params.displayName, params.senderEmail);
    const unique = [
      ...new Set(
        params.recipients.map((r) => r.trim().toLowerCase()).filter(Boolean)
      ),
    ];

    const results: LocalDeliveryResult[] = [];

    for (const email of unique) {
      try {
        const mailbox = await this.resolveLocalMailbox(email);
        if (!mailbox) {
          results.push({
            email,
            success: false,
            error: "Not a local mailbox",
          });
          continue;
        }

        const raw = buildRawMessage({
          from,
          senderEmail: params.senderEmail,
          input: params.input,
          messageId: params.messageId,
          includeBcc: false,
        });

        const inboxUid = await maildirService.deliverToInbox(mailbox.maildirPath, raw);
        console.info(
          `[Mail] Local delivery succeeded: ${params.senderEmail} -> ${email}`
        );
        const recipientMailbox = await mailPortalMailboxRepository.findByEmail(email);
        if (recipientMailbox) {
          void mailNotificationService.notifyMailReceived(
            recipientMailbox.id,
            params.senderEmail,
            params.input.subject || "(No subject)",
            {
              senderName: params.displayName ?? undefined,
              uid: inboxUid,
              receivedAt: new Date().toISOString(),
            }
          );
        }
        results.push({ email, success: true });
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "Delivery failed";
        console.error(
          `[Mail] Local delivery failed: ${params.senderEmail} -> ${email}:`,
          detail
        );
        results.push({ email, success: false, error: detail });
      }
    }

    return results;
  }
}

export const localMailDeliveryService = new LocalMailDeliveryService();
