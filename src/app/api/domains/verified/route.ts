import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { domainService } from "@/services/domain.service";
import { successResponse } from "@/utils/errors";
import { requireOrganizationAccess } from "@/middleware/auth";

export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async (req, user) => {
      if (!user.organizationId) {
        return successResponse([]);
      }
      requireOrganizationAccess(user, user.organizationId);
      const domains = await domainService.listVerified(user.organizationId);
      return successResponse(domains);
    },
    { permission: "domains:read" }
  );
}
