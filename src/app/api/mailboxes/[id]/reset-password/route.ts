import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { mailboxService } from "@/services/mailbox.service";
import { successResponse } from "@/utils/errors";
import { resetMailboxPasswordSchema } from "@/utils/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (req, user) => {
      const { id } = await params;
      const body = await req.json();
      const input = resetMailboxPasswordSchema.parse(body);
      await mailboxService.resetPassword(id, input.password, user);
      return successResponse(null, "Password reset successfully");
    },
    { permission: "mailboxes:update" }
  );
}
