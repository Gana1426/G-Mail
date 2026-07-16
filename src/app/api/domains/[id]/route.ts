import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { domainService } from "@/services/domain.service";
import { successResponse } from "@/utils/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (req, user) => {
      const { id } = await params;
      const domain = await domainService.getById(id);
      return successResponse(domain);
    },
    { permission: "domains:read" }
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
      await domainService.delete(id, user);
      return successResponse(null, "Domain removed");
    },
    { permission: "domains:delete" }
  );
}
