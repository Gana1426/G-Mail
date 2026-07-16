import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { mailboxService } from "@/services/mailbox.service";
import { successResponse } from "@/utils/errors";
import { createMailboxSchema } from "@/utils/validation";
import { getPaginationParams, buildPaginationMeta } from "@/utils";
import { serializeMailboxes } from "@/utils/serialize";
import { requireOrganizationAccess } from "@/middleware/auth";
import { ForbiddenError } from "@/utils/errors";
import { UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async (req, user) => {
      const { searchParams } = new URL(req.url);
      const params = getPaginationParams(searchParams);

      let organizationId: string | undefined;
      if (user.role === UserRole.SUPER_ADMIN) {
        organizationId = searchParams.get("organizationId") ?? undefined;
      } else {
        if (!user.organizationId) {
          throw new ForbiddenError("No organization associated with this account");
        }
        organizationId = user.organizationId;
      }

      if (organizationId) {
        requireOrganizationAccess(user, organizationId);
      }

      const { mailboxes, total } = await mailboxService.list({
        skip: params.skip,
        take: params.limit,
        organizationId,
        domainId: searchParams.get("domainId") ?? undefined,
        search: params.search,
        status: searchParams.get("status") ?? undefined,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
      });

      return successResponse(
        serializeMailboxes(mailboxes as Record<string, unknown>[]),
        undefined,
        buildPaginationMeta(total, params.page, params.limit)
      );
    },
    { permission: "mailboxes:read" }
  );
}

export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (req, user) => {
      const body = await req.json();
      const input = createMailboxSchema.parse(body);
      const organizationId = body.organizationId ?? user.organizationId;

      if (!organizationId) throw new Error("Organization ID required");
      requireOrganizationAccess(user, organizationId);

      const mailbox = await mailboxService.create(organizationId, input, user);
      return successResponse(
        serializeMailboxes([mailbox as Record<string, unknown>])[0],
        "Mailbox created successfully"
      );
    },
    { permission: "mailboxes:create" }
  );
}
