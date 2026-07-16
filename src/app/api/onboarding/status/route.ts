import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { onboardingService } from "@/services/onboarding.service";
import { successResponse } from "@/utils/errors";
import { ForbiddenError } from "@/utils/errors";

export async function GET(request: NextRequest) {
  return withAuth(request, async (_req, user) => {
    if (!user.organizationId) {
      throw new ForbiddenError("No organization associated with this account");
    }

    const status = await onboardingService.getStatus(user.organizationId);
    return successResponse(status);
  });
}
