import { NextRequest } from "next/server";
import { withMailAuth } from "@mail-portal/lib/mail-auth";
import { mailProfileService } from "@mail-portal/services/mail-settings.service";
import { successResponse } from "@/utils/errors";
import { verify2faSchema } from "@/utils/validation";

export async function GET(request: NextRequest) {
  return withMailAuth(request, async (_req, session) => {
    const result = await mailProfileService.setup2FA(session);
    return successResponse(result);
  });
}

export async function POST(request: NextRequest) {
  return withMailAuth(request, async (req, session) => {
    const body = await req.json();

    if (body.action === "enable") {
      const { code } = verify2faSchema.parse(body);
      await mailProfileService.enable2FA(session, code);
      return successResponse(null, "2FA enabled");
    }

    if (body.action === "disable") {
      const { code } = verify2faSchema.parse(body);
      await mailProfileService.disable2FA(session, code);
      return successResponse(null, "2FA disabled");
    }

    return successResponse(null);
  });
}
