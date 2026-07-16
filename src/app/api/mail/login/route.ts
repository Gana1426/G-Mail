import { NextRequest } from "next/server";
import { mailAuthService, setMailSessionResponse } from "@mail-portal/services/mail-auth.service";
import { handleApiError } from "@/utils/errors";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = loginSchema.parse(body);

    const result = await mailAuthService.login({
      email: input.email,
      password: input.password,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return setMailSessionResponse(
      {
        mailbox: result.mailbox,
        redirectTo: "/mail-portal",
      },
      result.jwt,
      "Login successful"
    );
  } catch (error) {
    return handleApiError(error);
  }
}
