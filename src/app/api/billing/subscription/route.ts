import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { billingService } from "@/services/billing.service";
import { successResponse } from "@/utils/errors";
import { ForbiddenError } from "@/utils/errors";
import { selectPlanSchema } from "@/utils/validation";
import { UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  return withAuth(request, async (_req, user) => {
    if (!user.organizationId) {
      throw new ForbiddenError("No organization associated with this account");
    }
    if (user.role !== UserRole.ORG_ADMIN) {
      throw new ForbiddenError("Only organization admins can view subscription");
    }

    const details = await billingService.getSubscriptionDetails(
      user.organizationId
    );
    return successResponse(details);
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    if (!user.organizationId) {
      throw new ForbiddenError("No organization associated with this account");
    }
    if (user.role !== UserRole.ORG_ADMIN) {
      throw new ForbiddenError("Only organization admins can upgrade plans");
    }

    const body = await req.json();
    const input = selectPlanSchema.parse(body);

    const result = await billingService.createUpgradeOrder(
      user.organizationId,
      input.planId,
      input.interval,
      user
    );

    return successResponse(result, "Upgrade initiated");
  });
}
