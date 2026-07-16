import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { dnsRecordsService } from "@/services/dns-records.service";
import { successResponse } from "@/utils/errors";
import { config } from "@/config";

export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async (req) => {
      const { searchParams } = new URL(req.url);
      const domainName = searchParams.get("domain");

      const record = dnsRecordsService.generateSpfRecord();
      return successResponse({
        record,
        mechanisms: ["mx", `ip4:${config.mail.serverIp}`, "-all"],
        domain: domainName,
      });
    },
    { permission: "domains:read" }
  );
}
