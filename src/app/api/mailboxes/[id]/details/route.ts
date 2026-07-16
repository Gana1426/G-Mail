import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { mailboxService } from "@/services/mailbox.service";
import { successResponse } from "@/utils/errors";
import { serializeMailbox } from "@/utils/serialize";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async () => {
      const { id } = await params;
      const details = await mailboxService.getDetails(id);
      return successResponse({
        mailbox: serializeMailbox(details.mailbox as Record<string, unknown>),
        aliases: details.aliases,
        forwarders: details.forwarders,
        activity: details.activity,
        usage: {
          usedBytes: details.usage.usedBytes.toString(),
          quotaBytes: details.usage.quotaBytes.toString(),
          remaining: details.usage.remaining.toString(),
          usagePercent: details.usage.usagePercent,
        },
      });
    },
    { permission: "mailboxes:read" }
  );
}
