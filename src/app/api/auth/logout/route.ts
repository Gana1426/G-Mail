import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { authService } from "@/services/auth.service";
import { successResponse } from "@/utils/errors";

export async function POST(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    await authService.logout(user.sessionId, user.id);

    const response = successResponse(null, "Logged out successfully");
    response.cookies.delete("access_token");
    response.cookies.delete("refresh_token");

    return response;
  });
}
