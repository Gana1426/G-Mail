import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { organizationService } from "@/services/organization.service";
import { successResponse } from "@/utils/errors";
import { requireOrganizationAccess } from "@/middleware/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (req, user) => {
      const { id } = await params;
      requireOrganizationAccess(user, id);
      const details = await organizationService.getDetails(id);
      return successResponse(details);
    },
    { permission: "organizations:read" }
  );
}
