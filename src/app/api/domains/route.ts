import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { domainService } from "@/services/domain.service";
import { successResponse } from "@/utils/errors";
import { createDomainSchema } from "@/utils/validation";
import { getPaginationParams, buildPaginationMeta } from "@/utils";
import { requireOrganizationAccess } from "@/middleware/auth";

export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async (req, user) => {
      const { searchParams } = new URL(req.url);
      const params = getPaginationParams(searchParams);
      const organizationId = searchParams.get("organizationId") ?? user.organizationId ?? undefined;

      if (organizationId) {
        requireOrganizationAccess(user, organizationId);
      }

      const { domains, total } = await domainService.list({
        skip: params.skip,
        take: params.limit,
        organizationId,
        search: params.search,
        status: searchParams.get("status") ?? undefined,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
      });

      return successResponse(
        domains,
        undefined,
        buildPaginationMeta(total, params.page, params.limit)
      );
    },
    { permission: "domains:read" }
  );
}

export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (req, user) => {
      const body = await req.json();
      const input = createDomainSchema.parse(body);
      const organizationId = body.organizationId ?? user.organizationId;

      if (!organizationId) {
        throw new Error("Organization ID required");
      }

      requireOrganizationAccess(user, organizationId);
      const domain = await domainService.create(organizationId, input, user);
      return successResponse(domain, "Domain added");
    },
    { permission: "domains:create" }
  );
}
