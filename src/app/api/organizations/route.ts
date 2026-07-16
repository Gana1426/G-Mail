import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { organizationService } from "@/services/organization.service";
import { successResponse } from "@/utils/errors";
import { createOrganizationSchema, organizationListQuerySchema } from "@/utils/validation";
import { getPaginationParams, buildPaginationMeta } from "@/utils";
import { serializeOrganization, serializeOrganizations } from "@/utils/serialize";
import { UserRole, OrganizationStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async (req, user) => {
      const { searchParams } = new URL(req.url);
      const params = getPaginationParams(searchParams);
      const filters = organizationListQuerySchema.parse({
        search: params.search || undefined,
        status: searchParams.get("status") || undefined,
        planId: searchParams.get("planId") || undefined,
        createdFrom: searchParams.get("createdFrom") || undefined,
        createdTo: searchParams.get("createdTo") || undefined,
        minDomainCount: searchParams.get("minDomainCount") || undefined,
        maxDomainCount: searchParams.get("maxDomainCount") || undefined,
      });

      const { organizations, total } = await organizationService.list({
        skip: params.skip,
        take: params.limit,
        search: filters.search,
        status: filters.status as OrganizationStatus | undefined,
        planId: filters.planId,
        createdFrom: filters.createdFrom
          ? new Date(`${filters.createdFrom}T00:00:00.000Z`)
          : undefined,
        createdTo: filters.createdTo
          ? new Date(`${filters.createdTo}T23:59:59.999Z`)
          : undefined,
        minDomainCount: filters.minDomainCount,
        maxDomainCount: filters.maxDomainCount,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
      });

      const filtered =
        user.role === UserRole.SUPER_ADMIN
          ? organizations
          : organizations.filter((o) => o.id === user.organizationId);

      return successResponse(
        serializeOrganizations(
          filtered as unknown as Record<string, unknown>[]
        ),
        undefined,
        buildPaginationMeta(total, params.page, params.limit)
      );
    },
    { permission: "organizations:read" }
  );
}

export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (req, user) => {
      const body = await req.json();
      const input = createOrganizationSchema.parse(body);
      const organization = await organizationService.create(input, user);
      return successResponse(
        serializeOrganization(organization as unknown as Record<string, unknown>),
        "Organization created"
      );
    },
    { roles: [UserRole.SUPER_ADMIN] }
  );
}
