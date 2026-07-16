import { NextRequest } from "next/server";
import { withMailAuth } from "@mail-portal/lib/mail-auth";
import { mailMessageService } from "@mail-portal/services/mail-message.service";
import { mailSendService } from "@mail-portal/services/mail-send.service";
import { mailNotificationService } from "@mail-portal/services/mail-notification.service";
import { successResponse } from "@/utils/errors";
import { z } from "zod";

const actionSchema = z.object({
  action: z.enum([
    "markRead",
    "markUnread",
    "star",
    "unstar",
    "delete",
    "deletePermanent",
    "archive",
    "spam",
    "notSpam",
    "restore",
    "move",
    "reply",
    "replyAll",
    "forward",
  ]),
  uids: z.array(z.string()).min(1),
  targetFolder: z.string().optional(),
  message: z
    .object({
      to: z.array(z.string().email()).optional(),
      cc: z.array(z.string().email()).optional(),
      bcc: z.array(z.string().email()).optional(),
      subject: z.string(),
      html: z.string(),
      text: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  return withMailAuth(request, async (req, session) => {
    const body = await req.json();
    const input = actionSchema.parse(body);

    if (input.action === "reply" && input.message && input.uids[0]) {
      const result = await mailMessageService.reply(
        session,
        input.uids[0],
        { ...input.message, to: input.message.to ?? [] },
        false
      );
      return successResponse(result, "Reply sent");
    }

    if (input.action === "replyAll" && input.message && input.uids[0]) {
      const result = await mailMessageService.reply(
        session,
        input.uids[0],
        { ...input.message, to: input.message.to ?? [] },
        true
      );
      return successResponse(result, "Reply sent");
    }

    if (input.action === "forward" && input.message && input.uids[0]) {
      const result = await mailMessageService.forward(
        session,
        input.uids[0],
        { ...input.message, to: input.message.to ?? [] }
      );
      return successResponse(result, "Message forwarded");
    }

    await mailMessageService.performAction(
      session,
      input.action,
      input.uids,
      input.targetFolder as import("@mail-portal/types/mail").MailFolderId
    );

    if (input.action === "delete") {
      const draftCount = input.uids.filter((uid) => uid.startsWith("DRAFTS:")).length;
      if (draftCount > 0) {
        void mailNotificationService.notifyDraftDeleted(session);
      }
      if (input.uids.length - draftCount > 0) {
        void mailNotificationService.notifyMailDeleted(
          session,
          input.uids.length - draftCount
        );
      }
    } else if (input.action === "spam") {
      void mailNotificationService.notifySpam(session, input.uids.length);
    }

    return successResponse(null, "Action completed");
  });
}
