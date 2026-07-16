import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { organizationService } from "@/services/organization.service";
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
      const body = await req.json();

      if (body.action === "suspend") {
        const org = await organizationService.suspend(id, body.reason, user);
        return successResponse(org, "Organization suspended");
      }

      if (body.action === "activate") {
        const org = await organizationService.activate(id, user);
        return successResponse(org, "Organization activated");
      }

      return successResponse(null);
    },
    { roles: [UserRole.SUPER_ADMIN] }
  );
}
