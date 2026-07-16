import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { userRepository } from "@/repositories/user.repository";
import { onboardingService } from "@/services/onboarding.service";
import { successResponse } from "@/utils/errors";

export async function GET(request: NextRequest) {
  return withAuth(request, async (_req, user) => {
    const fullUser = await userRepository.findByIdWithRelations(user.id);

    let onboarding = null;
    if (user.organizationId) {
      onboarding = await onboardingService.getStatus(user.organizationId);
    }

    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        emailVerified: user.emailVerified,
        organization: fullUser?.organization
          ? {
              id: fullUser.organization.id,
              name: fullUser.organization.name,
              status: fullUser.organization.status,
            }
          : null,
      },
      onboarding,
    });
  });
}
