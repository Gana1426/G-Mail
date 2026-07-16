import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { authService } from "@/services/auth.service";
import { successResponse } from "@/utils/errors";
import { verify2faSchema, changePasswordSchema } from "@/utils/validation";

export async function GET(request: NextRequest) {
  return withAuth(request, async (_req, user) => {
    const result = await authService.setup2FA(user.id);
    return successResponse(result);
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    const body = await req.json();

    if (body.action === "enable") {
      const { code } = verify2faSchema.parse(body);
      await authService.enable2FA(user.id, code);
      return successResponse(null, "2FA enabled");
    }

    if (body.action === "disable") {
      const { code } = verify2faSchema.parse(body);
      await authService.disable2FA(user.id, code);
      return successResponse(null, "2FA disabled");
    }

    if (body.currentPassword) {
      const input = changePasswordSchema.parse(body);
      await authService.changePassword(
        user.id,
        input.currentPassword,
        input.newPassword
      );
      return successResponse(null, "Password changed");
    }

    return successResponse(user);
  });
}
