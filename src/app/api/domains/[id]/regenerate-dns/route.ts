import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { domainService } from "@/services/domain.service";
import { successResponse } from "@/utils/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (req, user) => {
      const { id } = await params;
      const result = await domainService.regenerateDns(id, user);
      return successResponse(result, result.message);
    },
    { permission: "domains:update" }
  );
}
