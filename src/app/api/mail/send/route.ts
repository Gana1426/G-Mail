import { NextRequest } from "next/server";
import { withMailAuth } from "@mail-portal/lib/mail-auth";
import { mailSendService } from "@mail-portal/services/mail-send.service";
import { successResponse } from "@/utils/errors";
import { z } from "zod";

const sendSchema = z
  .object({
    to: z.array(z.string().email()).min(1),
    cc: z.array(z.string().email()).optional(),
    bcc: z.array(z.string().email()).optional(),
    subject: z.string().optional().default(""),
    html: z.string().optional(),
    text: z.string().optional(),
    priority: z.enum(["normal", "high", "low"]).optional(),
    requestReadReceipt: z.boolean().optional(),
    inReplyTo: z.string().optional(),
    references: z.array(z.string()).optional(),
    attachments: z
      .array(
        z.object({
          filename: z.string(),
          contentType: z.string(),
          content: z.string(),
        })
      )
      .optional(),
    draftUid: z.string().optional(),
  })
  .refine((data) => Boolean(data.html?.trim() || data.text?.trim()), {
    message: "Message body is required",
  });

export async function POST(request: NextRequest) {
  return withMailAuth(request, async (req, session) => {
    const body = await req.json();
    const input = sendSchema.parse(body);
    const result = await mailSendService.send(session, {
      ...input,
      html: input.html ?? "",
    });
    return successResponse(result, "Message sent successfully");
  });
}
