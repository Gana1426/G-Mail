import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { spamLogRepository } from "@/repositories/mail.repository";
import { mailboxService } from "@/services/mailbox.service";
import { successResponse } from "@/utils/errors";
import { getPaginationParams, buildPaginationMeta } from "@/utils";
import { spamSettingsSchema } from "@/utils/validation";

export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async (req) => {
      const { searchParams } = new URL(req.url);
      const params = getPaginationParams(searchParams);
      const quarantineOnly = searchParams.get("quarantine") === "true";
      const organizationId = searchParams.get("organizationId") ?? undefined;

      const { logs, total } = await spamLogRepository.findMany({
        skip: params.skip,
        take: params.limit,
        where: {
          ...(quarantineOnly ? { isQuarantined: true } : {}),
          ...(organizationId
            ? { mailbox: { organizationId } }
            : {}),
        },
        orderBy: { createdAt: "desc" },
      });

      const quarantineCount = await spamLogRepository.getQuarantineCount();

      return successResponse(
        { logs, quarantineCount },
        undefined,
        buildPaginationMeta(total, params.page, params.limit)
      );
    },
    { permission: "spam:read" }
  );
}

export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (req, user) => {
      const body = await req.json();

      if (body.action === "release" && body.id) {
        const log = await spamLogRepository.release(body.id);
        return successResponse(log, "Message released from quarantine");
      }

      if (body.action === "delete" && body.id) {
        await spamLogRepository.delete(body.id);
        return successResponse(null, "Spam message deleted");
      }

      if (body.mailboxId) {
        const settings = spamSettingsSchema.parse(body);
        const mailbox = await mailboxService.updateSpamSettings(body.mailboxId, settings);
        return successResponse(mailbox, "Spam settings updated");
      }

      return successResponse(null);
    },
    { permission: "spam:update" }
  );
}
