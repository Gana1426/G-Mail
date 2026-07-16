import { NextRequest } from "next/server";
import { withMailAuth } from "@mail-portal/lib/mail-auth";
import { clearMailSessionResponse } from "@mail-portal/services/mail-auth.service";

export async function POST(request: NextRequest) {
  return withMailAuth(request, async (_req, session) => {
    const { mailAuthService } = await import("@mail-portal/services/mail-auth.service");
    await mailAuthService.logout(session.sessionId);
    return clearMailSessionResponse();
  });
}
