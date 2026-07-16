import { NextRequest } from "next/server";
import { withMailAuth } from "@mail-portal/lib/mail-auth";
import { mailMessageService } from "@mail-portal/services/mail-message.service";
import { mailNotificationService } from "@mail-portal/services/mail-notification.service";
import { successResponse } from "@/utils/errors";

export async function GET(request: NextRequest) {
  return withMailAuth(request, async (_req, session) => {
    const stats = await mailMessageService.getDashboard(session);
    void mailNotificationService.checkStorageAndNotify(
      session,
      stats.storagePercent
    );
    return successResponse(stats);
  });
}
