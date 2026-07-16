import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { planEnforcementService } from "@/services/plan-enforcement.service";
import { successResponse } from "@/utils/errors";
import { ForbiddenError } from "@/utils/errors";
import { UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  return withAuth(request, async (_req, user) => {
    if (!user.organizationId) {
      throw new ForbiddenError("No organization associated with this account");
    }
    if (user.role !== UserRole.ORG_ADMIN) {
      throw new ForbiddenError("Only organization admins can view plan usage");
    }

    const summary = await planEnforcementService.getUsageSummary(
      user.organizationId
    );
    return successResponse(summary);
  });
}
