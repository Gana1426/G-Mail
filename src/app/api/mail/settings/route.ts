import { NextRequest } from "next/server";
import { withMailAuth } from "@mail-portal/lib/mail-auth";
import { mailSettingsService } from "@mail-portal/services/mail-settings.service";
import { successResponse } from "@/utils/errors";

export async function GET(request: NextRequest) {
  return withMailAuth(request, async (_req, session) => {
    const settings = await mailSettingsService.getSettings(session);
    return successResponse(settings);
  });
}

export async function PATCH(request: NextRequest) {
  return withMailAuth(request, async (req, session) => {
    const body = await req.json();
    const settings = await mailSettingsService.updateSettings(session, body);
    return successResponse(settings, "Settings updated");
  });
}

export async function POST(request: NextRequest) {
  return withMailAuth(request, async (req, session) => {
    const body = await req.json();
    if (body.action === "changePassword") {
      await mailSettingsService.changePassword(
        session,
        body.currentPassword,
        body.newPassword
      );
      return successResponse(null, "Password changed successfully");
    }
    if (body.action === "signature") {
      const signature = await mailSettingsService.upsertSignature(session, body);
      return successResponse(signature, "Signature saved");
    }
    if (body.action === "deleteSignature") {
      await mailSettingsService.deleteSignature(session, body.id);
      return successResponse(null, "Signature deleted");
    }
    if (body.action === "duplicateSignature") {
      const signature = await mailSettingsService.duplicateSignature(session, body.id);
      return successResponse(signature, "Signature duplicated");
    }
    if (body.action === "setDefaultSignature") {
      const signature = await mailSettingsService.setDefaultSignature(session, body.id);
      return successResponse(signature, "Default signature updated");
    }
    return successResponse(null);
  });
}
