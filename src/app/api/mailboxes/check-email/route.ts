import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { mailboxService } from "@/services/mailbox.service";
import { successResponse } from "@/utils/errors";
import { checkEmailSchema } from "@/utils/validation";

export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (req) => {
      const body = await req.json();
      const { email } = checkEmailSchema.parse(body);
      const available = await mailboxService.checkEmailAvailable(email);
      return successResponse({ available, email });
    },
    { permission: "mailboxes:read" }
  );
}
