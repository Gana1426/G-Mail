import { NextRequest } from "next/server";
import { authService } from "@/services/auth.service";
import { successResponse, handleApiError } from "@/utils/errors";
import { registerSchema } from "@/utils/validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = registerSchema.parse(body);

    const result = await authService.register(input);

    return successResponse(
      { userId: result.user.id },
      "Registration successful. Please verify your email."
    );
  } catch (error) {
    return handleApiError(error);
  }
}
