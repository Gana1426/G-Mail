import { NextRequest } from "next/server";
import { authService } from "@/services/auth.service";
import { successResponse, handleApiError } from "@/utils/errors";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await authService.verifyEmail(body.token);
    return successResponse(null, "Email verified successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
