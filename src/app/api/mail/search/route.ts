import { NextRequest } from "next/server";
import { withMailAuth } from "@mail-portal/lib/mail-auth";
import { mailMessageService } from "@mail-portal/services/mail-message.service";
import { successResponse } from "@/utils/errors";
import type { MailFolderId } from "@mail-portal/types/mail";

export async function GET(request: NextRequest) {
  return withMailAuth(request, async (req, session) => {
    const { searchParams } = new URL(req.url);
    const query = {
      q: searchParams.get("q") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      subject: searchParams.get("subject") ?? undefined,
      body: searchParams.get("body") ?? undefined,
      folder: (searchParams.get("folder") as MailFolderId) ?? undefined,
      hasAttachment: searchParams.get("hasAttachment") === "true",
      isRead: searchParams.get("isRead") === "true",
      isUnread: searchParams.get("isUnread") === "true",
      isStarred: searchParams.get("isStarred") === "true",
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      page: parseInt(searchParams.get("page") ?? "1", 10),
      limit: parseInt(searchParams.get("limit") ?? "25", 10),
    };

    const result = await mailMessageService.search(session, query);
    return successResponse(result);
  });
}
