import { NextRequest } from "next/server";
import { withMailAuth } from "@mail-portal/lib/mail-auth";
import { mailMessageService } from "@mail-portal/services/mail-message.service";
import { successResponse } from "@/utils/errors";

export async function GET(request: NextRequest) {
  return withMailAuth(request, async (_req, session) => {
    const result = await mailMessageService.listInbox(session, "TRASH", {
      page: 1,
      limit: 50,
    });
    return successResponse(result);
  });
}

export async function POST(request: NextRequest) {
  return withMailAuth(request, async (req, session) => {
    const body = await req.json();
    const { action, uids } = body as { action: string; uids: string[] };
    await mailMessageService.performAction(session, action, uids);
    return successResponse(null, "Action completed");
  });
}
