import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { domainService } from "@/services/domain.service";
import { successResponse } from "@/utils/errors";
import { dmarcGeneratorSchema } from "@/utils/validation";

export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (req) => {
      const body = await req.json();
      const input = dmarcGeneratorSchema.parse(body);
      const domain = body.domain ?? "example.com";

      const record = domainService.generateDmarcRecord(
        domain,
        input.policy,
        input.percentage,
        input.rua,
        input.ruf
      );

      return successResponse({
        record,
        policy: input.policy,
        percentage: input.percentage ?? 100,
        rua: input.rua,
        ruf: input.ruf,
        dnsName: `_dmarc.${domain}`,
      });
    },
    { permission: "domains:read" }
  );
}
