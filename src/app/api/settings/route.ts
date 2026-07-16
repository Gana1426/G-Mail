import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { settingRepository } from "@/repositories/mail.repository";
import { successResponse } from "@/utils/errors";
import { settingsSchema } from "@/utils/validation";
import { config } from "@/config";
import { UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async (req) => {
      const dbSettings = await settingRepository.getAll();
      const settingsMap = Object.fromEntries(
        dbSettings.map((s) => [s.key, s.value])
      );

      const mailSettings = {
        smtp: {
          hostname: config.mail.hostname,
          port: config.mail.smtpPort,
          tls: true,
          ssl: false,
          auth: true,
          maxConnections: 100,
          maxMessageSize: 52428800,
          ...(settingsMap.smtp as object),
        },
        imap: {
          port: config.mail.imapPort,
          ssl: true,
          tls: true,
          ...(settingsMap.imap as object),
        },
        pop3: {
          port: config.mail.pop3Port,
          ssl: true,
          tls: true,
          ...(settingsMap.pop3 as object),
        },
      };

      return successResponse(mailSettings);
    },
    { permission: "settings:read" }
  );
}

export async function PATCH(request: NextRequest) {
  return withAuth(
    request,
    async (req) => {
      const body = await req.json();
      const input = settingsSchema.parse(body);

      if (input.smtp) {
        await settingRepository.upsert("smtp", input.smtp, "mail");
      }
      if (input.imap) {
        await settingRepository.upsert("imap", input.imap, "mail");
      }
      if (input.pop3) {
        await settingRepository.upsert("pop3", input.pop3, "mail");
      }

      return successResponse(null, "Settings updated");
    },
    { roles: [UserRole.SUPER_ADMIN] }
  );
}
