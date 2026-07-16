import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { aliasService } from "@/services/mailbox.service";
import { successResponse } from "@/utils/errors";
import { updateAliasSchema } from "@/utils/validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (req, user) => {
      const { id } = await params;
      const body = await req.json();
      const input = updateAliasSchema.parse(body);
      const alias = await aliasService.update(id, input, user);
      return successResponse(alias, "Alias updated");
    },
    { permission: "aliases:update" }
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
      await aliasService.delete(id, user);
      return successResponse(null, "Alias deleted");
    },
    { permission: "aliases:delete" }
  );
}
