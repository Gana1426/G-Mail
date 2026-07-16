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
    async () => {
      const { id } = await params;
      const eligibility = await domainService.getDeleteEligibility(id);
      return successResponse(eligibility);
    },
    { permission: "domains:read" }
  );
}
