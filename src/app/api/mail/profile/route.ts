import { NextRequest } from "next/server";
import { withMailAuth } from "@mail-portal/lib/mail-auth";
import { mailProfileService } from "@mail-portal/services/mail-settings.service";
import { successResponse } from "@/utils/errors";

export async function GET(request: NextRequest) {
  return withMailAuth(request, async (_req, session) => {
    const profile = await mailProfileService.getProfile(session);
    return successResponse(profile);
  });
}

export async function PATCH(request: NextRequest) {
  return withMailAuth(request, async (req, session) => {
    const body = await req.json();
    const profile = await mailProfileService.updateProfile(session, body);
    return successResponse(profile, "Profile updated");
  });
}

export async function DELETE(request: NextRequest) {
  return withMailAuth(request, async (req, session) => {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) {
      return successResponse(null);
    }
    await mailProfileService.revokeSession(session, sessionId);
    return successResponse(null, "Session revoked");
  });
}
