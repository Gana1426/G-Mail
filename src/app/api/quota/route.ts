import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { mailboxService } from "@/services/mailbox.service";
import { successResponse } from "@/utils/errors";
import { UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async (req, user) => {
      const { searchParams } = new URL(req.url);
      let organizationId = user.organizationId ?? undefined;

      if (user.role === UserRole.SUPER_ADMIN) {
        organizationId = searchParams.get("organizationId") ?? undefined;
      }

      const stats = await mailboxService.getStats(organizationId);
      return successResponse({
        ...stats,
        totalQuota: stats.totalQuota.toString(),
        totalUsed: stats.totalUsed.toString(),
        organizationId: organizationId ?? null,
      });
    },
    { permission: "storage:read" }
  );
}
