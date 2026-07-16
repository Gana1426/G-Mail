import { NextRequest } from "next/server";
import { withMailAuth } from "@mail-portal/lib/mail-auth";
import { mailMessageService } from "@mail-portal/services/mail-message.service";
import { successResponse } from "@/utils/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  return withMailAuth(request, async (_req, session) => {
    const { uid } = await params;
    const { searchParams } = new URL(request.url);

    if (searchParams.get("format") === "eml") {
      const raw = await mailMessageService.downloadEml(
        session,
        decodeURIComponent(uid)
      );
      if (!raw) {
        return Response.json({ success: false, error: "Not found" }, { status: 404 });
      }
      return new Response(new Uint8Array(raw), {
        headers: {
          "Content-Type": "message/rfc822",
          "Content-Disposition": `attachment; filename="message.eml"`,
        },
      });
    }

    const message = await mailMessageService.getMessage(
      session,
      decodeURIComponent(uid)
    );
    return successResponse(message);
  });
}
