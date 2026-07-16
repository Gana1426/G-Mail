import { NextRequest } from "next/server";
import { withMailAuth } from "@mail-portal/lib/mail-auth";
import { mailMessageService } from "@mail-portal/services/mail-message.service";
import { successResponse } from "@/utils/errors";

export async function GET(request: NextRequest) {
  return withMailAuth(request, async (_req, session) => {
    const folders = await mailMessageService.getFolders(session);
    return successResponse(folders);
  });
}
