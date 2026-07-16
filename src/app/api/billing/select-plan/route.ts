import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { billingService } from "@/services/billing.service";
import { successResponse } from "@/utils/errors";
import { ForbiddenError } from "@/utils/errors";
import { selectPlanSchema } from "@/utils/validation";
import { UserRole } from "@prisma/client";

export async function POST(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    if (!user.organizationId) {
      throw new ForbiddenError("No organization associated with this account");
    }
    if (user.role !== UserRole.ORG_ADMIN) {
      throw new ForbiddenError("Only organization admins can select a plan");
    }

    const body = await req.json();
    const input = selectPlanSchema.parse(body);

    const status = await billingService.activateFreePlan(
      user.organizationId,
      input.planId,
      user
    );

    return successResponse(status, "Free plan activated successfully");
  });
}
