import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { organizationService } from "@/services/organization.service";
import { successResponse } from "@/utils/errors";
import { resetOwnerPasswordSchema, changePlanSchema } from "@/utils/validation";
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
      const input = resetOwnerPasswordSchema.parse(body);
      const result = await organizationService.resetOwnerPassword(
        id,
        { password: input.password, generate: input.generate },
        user
      );
      return successResponse(
        result,
        input.generate
          ? "Owner password generated and reset successfully"
          : "Owner password reset successfully"
      );
    },
    { roles: [UserRole.SUPER_ADMIN] }
  );
}
