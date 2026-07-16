import { NextRequest } from "next/server";
import { withMailAuth } from "@mail-portal/lib/mail-auth";
import { mailSendService } from "@mail-portal/services/mail-send.service";
import { mailMessageService } from "@mail-portal/services/mail-message.service";
import { mailNotificationService } from "@mail-portal/services/mail-notification.service";
import { successResponse } from "@/utils/errors";
import { z } from "zod";

const draftSchema = z.object({
  to: z.array(z.string()).optional(),
  cc: z.array(z.string()).optional(),
  bcc: z.array(z.string()).optional(),
  subject: z.string().optional(),
  html: z.string().optional(),
  text: z.string().optional(),
  draftUid: z.string().optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        contentType: z.string(),
        content: z.string(),
      })
    )
    .optional(),
});

const deleteDraftSchema = z.object({
  uids: z.array(z.string()).min(1),
  permanent: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  return withMailAuth(request, async (req, session) => {
    const { mailMessageService } = await import("@mail-portal/services/mail-message.service");
    const result = await mailMessageService.listInbox(session, "DRAFTS", {
      page: 1,
      limit: 50,
    });
    return successResponse(result);
  });
}

export async function POST(request: NextRequest) {
  return withMailAuth(request, async (req, session) => {
    const body = await req.json();
    const input = draftSchema.parse(body);
    const draftUid = await mailSendService.saveDraft(session, input);
    return successResponse({ draftUid }, "Draft saved successfully.");
  });
}

export async function DELETE(request: NextRequest) {
  return withMailAuth(request, async (req, session) => {
    const body = await req.json();
    const input = deleteDraftSchema.parse(body);
    await mailMessageService.performAction(
      session,
      input.permanent ? "deletePermanent" : "delete",
      input.uids
    );
    if (!input.permanent) {
      void mailNotificationService.notifyDraftDeleted(session);
    }
    return successResponse(
      null,
      input.permanent
        ? "Draft permanently deleted."
        : "Draft moved to trash."
    );
  });
}
