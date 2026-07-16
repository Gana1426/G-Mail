import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { organizationService } from "@/services/organization.service";
import { successResponse } from "@/utils/errors";
import { updateOrganizationSchema } from "@/utils/validation";
import { requireOrganizationAccess } from "@/middleware/auth";
import { serializeOrganization } from "@/utils/serialize";
import { UserRole } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (req, user) => {
      const { id } = await params;
      requireOrganizationAccess(user, id);
      const organization = await organizationService.getById(id);
      return successResponse(
        serializeOrganization(organization as unknown as Record<string, unknown>)
      );
    },
    { permission: "organizations:read" }
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (req, user) => {
      const { id } = await params;
      requireOrganizationAccess(user, id);
      const body = await req.json();
      const input = updateOrganizationSchema.parse(body);
      const organization = await organizationService.update(id, input, user);
      return successResponse(
        serializeOrganization(organization as unknown as Record<string, unknown>),
        "Organization updated"
      );
    },
    { permission: "organizations:update" }
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (req, user) => {
      const { id } = await params;
      await organizationService.delete(id, user);
      return successResponse(null, "Organization deleted");
    },
    { roles: [UserRole.SUPER_ADMIN] }
  );
}
