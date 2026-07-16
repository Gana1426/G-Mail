import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { webmailService } from "@/services/mailbox.service";
import { mailboxRepository } from "@/repositories/mailbox.repository";
import { userRepository } from "@/repositories/user.repository";
import { successResponse } from "@/utils/errors";
import { config } from "@/config";
import { ForbiddenError } from "@/utils/errors";

export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (req, user) => {
      const body = await req.json().catch(() => ({}));
      let email: string | undefined;

      if (body.mailboxId) {
        const mailbox = await mailboxRepository.findById(body.mailboxId);
        if (!mailbox) {
          return successResponse({
            roundcubeUrl: config.roundcube.url,
            sso: false,
          });
        }
        if (
          user.role !== "SUPER_ADMIN" &&
          user.organizationId !== mailbox.organizationId
        ) {
          throw new ForbiddenError("Cannot access this mailbox");
        }
        email = mailbox.email;
      } else {
        const fullUser = await userRepository.findByIdWithRelations(user.id);
        email = fullUser?.mailbox?.email;
      }

      if (!email) {
        return successResponse({
          roundcubeUrl: config.roundcube.url,
          sso: false,
          message: "No mailbox associated — opening webmail login",
        });
      }

      const sso = webmailService.generateSsoToken(email, "");
      return successResponse({ ...sso, sso: true, email });
    },
    { permission: "webmail:read" }
  );
}
