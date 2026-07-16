import { NextRequest } from "next/server";
import { withMailAuth } from "@mail-portal/lib/mail-auth";
import { mailMessageService } from "@mail-portal/services/mail-message.service";
import { successResponse } from "@/utils/errors";
import type { MailFolderId } from "@mail-portal/types/mail";

export async function GET(request: NextRequest) {
  return withMailAuth(request, async (req, session) => {
    const { searchParams } = new URL(req.url);
    const folder = (searchParams.get("folder") ?? "INBOX") as MailFolderId;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "25", 10);
    const q = searchParams.get("q") ?? undefined;

    const result = await mailMessageService.listInbox(session, folder, {
      page,
      limit,
      q,
    });

    return successResponse(result.messages, undefined, {
      page: result.page,
      limit,
      total: result.total,
      totalPages: result.totalPages,
      hasNext: result.page < result.totalPages,
      hasPrev: result.page > 1,
    });
  });
}
