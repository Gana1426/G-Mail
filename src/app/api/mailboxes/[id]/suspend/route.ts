import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { mailboxService } from "@/services/mailbox.service";
import { successResponse } from "@/utils/errors";
import { z } from "zod";

const suspendSchema = z.object({
  reason: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (req, user) => {
      const { id } = await params;
      const body = await req.json().catch(() => ({}));
      const input = suspendSchema.parse(body);
      const mailbox = await mailboxService.suspend(id, input.reason, user);
      return successResponse(mailbox, "Mailbox suspended");
    },
    { permission: "mailboxes:update" }
  );
}
