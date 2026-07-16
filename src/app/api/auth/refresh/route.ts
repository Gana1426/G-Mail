import { NextRequest } from "next/server";
import { authService } from "@/services/auth.service";
import { successResponse, handleApiError } from "@/utils/errors";

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get("refresh_token")?.value;

    if (!refreshToken) {
      return handleApiError(new Error("No refresh token"));
    }

    const tokens = await authService.refreshToken(refreshToken);

    const response = successResponse(tokens, "Token refreshed");

    response.cookies.set("access_token", tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokens.expiresIn,
      path: "/",
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
