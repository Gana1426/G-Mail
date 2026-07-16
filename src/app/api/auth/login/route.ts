import { NextRequest } from "next/server";
import { authService } from "@/services/auth.service";
import { successResponse, handleApiError } from "@/utils/errors";
import { loginSchema, registerSchema } from "@/utils/validation";
import { getClientIp, getUserAgent } from "@/utils";
import { UserRole } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = loginSchema.parse(body);

    const result = await authService.login(
      input,
      getClientIp(request),
      getUserAgent(request)
    );

    const response = successResponse(result, "Login successful");

    response.cookies.set("access_token", result.tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: result.tokens.expiresIn,
      path: "/",
    });

    response.cookies.set("refresh_token", result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
