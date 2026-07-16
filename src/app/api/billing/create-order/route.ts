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
      throw new ForbiddenError("Only organization admins can create payment orders");
    }

    const body = await req.json();
    const input = selectPlanSchema.parse(body);

    const order = await billingService.createPaymentOrder(
      user.organizationId,
      input.planId,
      input.interval,
      user
    );

    return successResponse(order, "Payment order created");
  });
}
