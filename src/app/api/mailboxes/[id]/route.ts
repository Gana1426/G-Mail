import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { mailboxService } from "@/services/mailbox.service";
import { successResponse } from "@/utils/errors";
import { serializeMailbox } from "@/utils/serialize";
import { updateMailboxSchema, vacationSchema } from "@/utils/validation";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (req, user) => {
      const { id } = await params;
      const mailbox = await mailboxService.getById(id);
      return successResponse(serializeMailbox(mailbox as Record<string, unknown>));
    },
    { permission: "mailboxes:read" }
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
      const body = await req.json();

      if (body.vacation !== undefined || body.enabled !== undefined) {
        const input = vacationSchema.parse(body);
        const mailbox = await mailboxService.setVacation(id, input, user.id);
        return successResponse(mailbox, "Vacation settings updated");
      }

      const input = updateMailboxSchema.parse(body);
      const mailbox = await mailboxService.update(id, input, user);
      return successResponse(mailbox, "Mailbox updated");
    },
    { permission: "mailboxes:update" }
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
      await mailboxService.delete(id, user);
      return successResponse(null, "Mailbox deleted");
    },
    { permission: "mailboxes:delete" }
  );
}
