import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { planService } from "@/services/plan.service";
import { successResponse } from "@/utils/errors";
import { createPlanSchema } from "@/utils/validation";
import { getPaginationParams, buildPaginationMeta } from "@/utils";
import { UserRole } from "@prisma/client";

function serializePlan(plan: Record<string, unknown>) {
  return {
    ...plan,
    storageQuotaBytes: plan.storageQuotaBytes?.toString(),
  };
}

export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async (req) => {
      const { searchParams } = new URL(req.url);
      const params = getPaginationParams(searchParams);

      const { plans, total } = await planService.list({
        skip: params.skip,
        take: params.limit,
        search: params.search,
        status: searchParams.get("status") ?? undefined,
        tier: searchParams.get("tier") ?? undefined,
      });

      return successResponse(
        plans.map((p) => serializePlan(p as Record<string, unknown>)),
        undefined,
        buildPaginationMeta(total, params.page, params.limit)
      );
    },
    { permission: "organizations:read" }
  );
}

export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (req, user) => {
      const body = await req.json();
      const input = createPlanSchema.parse(body);
      const plan = await planService.create(input, user);
      return successResponse(
        serializePlan(plan as Record<string, unknown>),
        "Plan created"
      );
    },
    { roles: [UserRole.SUPER_ADMIN] }
  );
}
