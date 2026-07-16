import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { planService } from "@/services/plan.service";
import { successResponse } from "@/utils/errors";
import { updatePlanSchema } from "@/utils/validation";
import { UserRole } from "@prisma/client";

function serializePlan(plan: Record<string, unknown>) {
  return {
    ...plan,
    storageQuotaBytes: plan.storageQuotaBytes?.toString(),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async () => {
      const { id } = await params;
      const plan = await planService.getById(id);
      return successResponse(serializePlan(plan as Record<string, unknown>));
    },
    { permission: "organizations:read" }
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (req, user) => {
      const { id } = await params;
      const body = await req.json();
      const input = updatePlanSchema.parse(body);
      const plan = await planService.update(id, input, user);
      return successResponse(
        serializePlan(plan as Record<string, unknown>),
        "Plan updated"
      );
    },
    { roles: [UserRole.SUPER_ADMIN] }
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (req, user) => {
      const { id } = await params;
      await planService.delete(id, user);
      return successResponse(null, "Plan deleted");
    },
    { roles: [UserRole.SUPER_ADMIN] }
  );
}
