import { NextRequest } from "next/server";
import { authService } from "@/services/auth.service";
import { emailService } from "@/services/email.service";
import { successResponse, handleApiError } from "@/utils/errors";
import { forgotPasswordSchema, resetPasswordSchema } from "@/utils/validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.token) {
      const input = resetPasswordSchema.parse(body);
      await authService.resetPassword(input.token, input.password);
      return successResponse(null, "Password reset successful");
    }

    const input = forgotPasswordSchema.parse(body);
    const token = await authService.forgotPassword(input.email);

    if (input.email) {
      await emailService.sendPasswordResetEmail(input.email, token);
    }

    return successResponse(
      null,
      "If an account exists, a reset link has been sent"
    );
  } catch (error) {
    return handleApiError(error);
  }
}
