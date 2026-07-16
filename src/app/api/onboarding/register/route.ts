import { NextRequest } from "next/server";
import { onboardingService } from "@/services/onboarding.service";
import { emailService } from "@/services/email.service";
import { successResponse, handleApiError } from "@/utils/errors";
import { onboardingRegisterSchema } from "@/utils/validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = onboardingRegisterSchema.parse(body);

    const result = await onboardingService.register(input);

    await emailService.sendVerificationEmail(
      result.user.email,
      result.verificationToken
    );

    return successResponse(
      { userId: result.user.id, organizationId: result.organization.id },
      "Registration successful. Please check your email to verify your account."
    );
  } catch (error) {
    return handleApiError(error);
  }
}
