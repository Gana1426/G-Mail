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
      const dnsRecords = await domainService.getDnsRecords(id);
      const domain = await domainService.getById(id);
      return successResponse({ domain, dnsRecords });
    },
    { permission: "domains:read" }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (req, user) => {
      const { id } = await params;
      const domain = await domainService.getById(id);
      const dnsRecords = await domainService.getDnsRecords(id);
      return successResponse(
        { domain, dnsRecords },
        "DNS records generated"
      );
    },
    { permission: "domains:update" }
  );
}
