import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { organizationService } from "@/services/organization.service";
import { successResponse } from "@/utils/errors";
import { UserRole } from "@prisma/client";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (req, user) => {
      const { id } = await params;
      await organizationService.permanentlyDelete(id, user);
      return successResponse(null, "Organization permanently deleted");
    },
    { roles: [UserRole.SUPER_ADMIN] }
  );
}
