import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { billingService } from "@/services/billing.service";
import { successResponse } from "@/utils/errors";
import { ForbiddenError } from "@/utils/errors";
import { UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  return withAuth(request, async (_req, user) => {
    if (user.role !== UserRole.ORG_ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenError("Access denied");
    }

    const plans = await billingService.listPlans();
    return successResponse(
      plans.map((p) => ({
        ...p,
        storageQuotaBytes: p.storageQuotaBytes.toString(),
        isFree:
          p.tier === "FREE" || (p.monthlyPrice === 0 && p.yearlyPrice === 0),
      }))
    );
  });
}
