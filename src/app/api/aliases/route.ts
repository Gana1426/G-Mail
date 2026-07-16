import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { aliasService } from "@/services/mailbox.service";
import { successResponse } from "@/utils/errors";
import { createAliasSchema } from "@/utils/validation";
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

      const { aliases, total } = await aliasService.list({
        skip: params.skip,
        take: params.limit,
        organizationId,
        domainId: searchParams.get("domainId") ?? undefined,
        search: params.search,
      });

      return successResponse(
        aliases,
        undefined,
        buildPaginationMeta(total, params.page, params.limit)
      );
    },
    { permission: "aliases:read" }
  );
}

export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (req, user) => {
      const body = await req.json();
      const input = createAliasSchema.parse(body);
      const organizationId = body.organizationId ?? user.organizationId;

      if (!organizationId) throw new Error("Organization ID required");
      requireOrganizationAccess(user, organizationId);

      const alias = await aliasService.create(organizationId, input, user);
      return successResponse(alias, "Alias created");
    },
    { permission: "aliases:create" }
  );
}
