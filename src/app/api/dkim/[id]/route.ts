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
      const result = await domainService.rotateDkim(id, user);
      return successResponse(result, "DKIM keys rotated");
    },
    { permission: "domains:update" }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (req, user) => {
      const { id } = await params;
      const domain = await domainService.getById(id);
      return successResponse({
        selector: domain.dkimSelector,
        publicKey: domain.dkimPublicKey,
        dnsRecord: domain.dkimPublicKey
          ? `${domain.dkimSelector}._domainkey.${domain.name}`
          : null,
      });
    },
    { permission: "domains:read" }
  );
}
