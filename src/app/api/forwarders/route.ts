import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { forwarderService } from "@/services/mailbox.service";
import { successResponse } from "@/utils/errors";
import { createForwarderSchema } from "@/utils/validation";
import { getPaginationParams, buildPaginationMeta } from "@/utils";
import { requireOrganizationAccess } from "@/middleware/auth";

export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async (req, user) => {
      const { searchParams } = new URL(req.url);
      const params = getPaginationParams(searchParams);
      const organizationId = searchParams.get("organizationId") ?? user.organizationId ?? undefined;

      if (organizationId) requireOrganizationAccess(user, organizationId);

      const { forwarders, total } = await forwarderService.list({
        skip: params.skip,
        take: params.limit,
        organizationId,
        search: params.search,
      });

      return successResponse(
        forwarders,
        undefined,
        buildPaginationMeta(total, params.page, params.limit)
      );
    },
    { permission: "forwarders:read" }
  );
}

export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (req, user) => {
      const body = await req.json();
      const input = createForwarderSchema.parse(body);
      const organizationId = body.organizationId ?? user.organizationId;

      if (!organizationId) throw new Error("Organization ID required");
      requireOrganizationAccess(user, organizationId);

      const forwarder = await forwarderService.create(organizationId, input, user);
      return successResponse(forwarder, "Forwarder created");
    },
    { permission: "forwarders:create" }
  );
}
