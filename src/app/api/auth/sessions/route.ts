import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { authService } from "@/services/auth.service";
import { successResponse } from "@/utils/errors";
import { UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    const sessions = await authService.getSessions(user.id);
    return successResponse(sessions);
  });
}

export async function DELETE(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (sessionId) {
      await authService.revokeSession(user.id, sessionId);
    } else {
      await authService.logoutAll(user.id, user.sessionId);
    }

    return successResponse(null, "Session revoked");
  });
}
