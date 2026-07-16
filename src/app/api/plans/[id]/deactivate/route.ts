import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { planService } from "@/services/plan.service";
import { successResponse } from "@/utils/errors";
import { UserRole } from "@prisma/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (req, user) => {
      const { id } = await params;
      const plan = await planService.deactivate(id, user);
      return successResponse(plan, "Plan deactivated");
    },
    { roles: [UserRole.SUPER_ADMIN] }
  );
}
