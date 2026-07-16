import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { planService } from "@/services/plan.service";
import { successResponse } from "@/utils/errors";
import { clonePlanSchema } from "@/utils/validation";
import { UserRole } from "@prisma/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (req, user) => {
      const { id } = await params;
      const body = await req.json();
      const { code } = clonePlanSchema.parse(body);
      const plan = await planService.clone(id, code, user);
      return successResponse(
        {
          ...plan,
          storageQuotaBytes: plan.storageQuotaBytes.toString(),
        },
        "Plan cloned"
      );
    },
    { roles: [UserRole.SUPER_ADMIN] }
  );
}
