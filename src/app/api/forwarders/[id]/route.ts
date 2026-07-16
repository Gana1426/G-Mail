import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { forwarderService } from "@/services/mailbox.service";
import { successResponse } from "@/utils/errors";
import { updateForwarderSchema } from "@/utils/validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (req, user) => {
      const { id } = await params;
      const body = await req.json();
      const input = updateForwarderSchema.parse(body);
      const forwarder = await forwarderService.update(id, input, user);
      return successResponse(forwarder, "Forwarder updated");
    },
    { permission: "forwarders:update" }
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
      await forwarderService.delete(id, user);
      return successResponse(null, "Forwarder deleted");
    },
    { permission: "forwarders:delete" }
  );
}
