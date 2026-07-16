import { NextRequest } from "next/server";
import { withMailAuth } from "@mail-portal/lib/mail-auth";
import { mailNotificationService } from "@mail-portal/services/mail-notification.service";
import { successResponse } from "@/utils/errors";
import { z } from "zod";

export async function GET(request: NextRequest) {
  return withMailAuth(request, async (req, session) => {
    const unreadOnly = req.nextUrl.searchParams.get("unreadOnly") === "true";
    const [notifications, unreadCount] = await Promise.all([
      mailNotificationService.listForSession(session, unreadOnly),
      mailNotificationService.unreadCount(session),
    ]);
    return successResponse({ notifications, unreadCount });
  });
}

const patchSchema = z.object({
  action: z.enum(["markRead", "markAllRead"]),
  id: z.string().optional(),
});

export async function PATCH(request: NextRequest) {
  return withMailAuth(request, async (req, session) => {
    const body = patchSchema.parse(await req.json());
    if (body.action === "markAllRead") {
      await mailNotificationService.markAllRead(session);
    } else if (body.id) {
      await mailNotificationService.markRead(session, body.id);
    }
    const unreadCount = await mailNotificationService.unreadCount(session);
    return successResponse({ unreadCount }, "Notification updated");
  });
}

const deleteSchema = z.object({
  id: z.string(),
});

export async function DELETE(request: NextRequest) {
  return withMailAuth(request, async (req, session) => {
    const body = deleteSchema.parse(await req.json());
    await mailNotificationService.delete(session, body.id);
    const unreadCount = await mailNotificationService.unreadCount(session);
    return successResponse({ unreadCount }, "Notification deleted");
  });
}
