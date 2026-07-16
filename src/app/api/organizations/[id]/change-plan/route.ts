import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { organizationService } from "@/services/organization.service";
import { successResponse } from "@/utils/errors";
import { changePlanSchema } from "@/utils/validation";
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
      const { planId } = changePlanSchema.parse(body);
      const org = await organizationService.changePlan(id, planId, user);
      return successResponse(
        {
          ...org,
          storageQuota: org.storageQuota.toString(),
          storageUsed: org.storageUsed.toString(),
        },
        "Plan updated"
      );
    },
    { roles: [UserRole.SUPER_ADMIN] }
  );
}
