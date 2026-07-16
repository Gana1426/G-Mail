import { NextRequest } from "next/server";
import { withMailAuth } from "@mail-portal/lib/mail-auth";
import { mailMessageService } from "@mail-portal/services/mail-message.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string; attachmentId: string }> }
) {
  return withMailAuth(request, async (_req, session) => {
    const { uid, attachmentId } = await params;
    const attachment = await mailMessageService.getAttachment(
      session,
      decodeURIComponent(uid),
      decodeURIComponent(attachmentId)
    );

    if (!attachment) {
      return Response.json({ success: false, error: "Not found" }, { status: 404 });
    }

    return new Response(new Uint8Array(attachment.content), {
      headers: {
        "Content-Type": attachment.contentType,
        "Content-Disposition": `inline; filename="${attachment.filename}"`,
      },
    });
  });
}
