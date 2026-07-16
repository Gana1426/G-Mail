import { NextRequest } from "next/server";
import { withAuth, requireOrganizationAccess } from "@/middleware/auth";
import { organizationRepository } from "@/repositories/organization.repository";
import { successResponse } from "@/utils/errors";
import { z } from "zod";
import { NotFoundError } from "@/utils/errors";

const orgSettingsSchema = z.object({
  general: z
    .object({
      companyName: z.string().max(100).optional(),
      timezone: z.string().max(50).optional(),
      language: z.string().max(10).optional(),
      dateFormat: z.string().max(20).optional(),
      timeFormat: z.string().max(10).optional(),
      theme: z.enum(["light", "dark", "system"]).optional(),
    })
    .optional(),
  mail: z
    .object({
      smtpHost: z.string().optional(),
      smtpPort: z.number().optional(),
      imapPort: z.number().optional(),
      pop3Port: z.number().optional(),
      ssl: z.boolean().optional(),
      tls: z.boolean().optional(),
      maxMessageSize: z.number().optional(),
      defaultQuotaBytes: z.number().optional(),
    })
    .optional(),
  security: z
    .object({
      passwordMinLength: z.number().min(8).optional(),
      requireUppercase: z.boolean().optional(),
      requireNumbers: z.boolean().optional(),
      requireSpecialChars: z.boolean().optional(),
      twoFactorRequired: z.boolean().optional(),
      sessionTimeoutMinutes: z.number().optional(),
      loginAlerts: z.boolean().optional(),
      recoveryEmail: z.string().email().optional(),
    })
    .optional(),
});

export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async (_req, user) => {
      if (!user.organizationId) throw new NotFoundError("No organization");
      requireOrganizationAccess(user, user.organizationId);

      const org = await organizationRepository.findById(user.organizationId);
      if (!org) throw new NotFoundError("Organization not found");

      const settings = (org.settings as Record<string, unknown>) ?? {};
      return successResponse({
        organization: { id: org.id, name: org.name },
        settings,
      });
    },
    { permission: "organizations:read" }
  );
}

export async function PATCH(request: NextRequest) {
  return withAuth(
    request,
    async (req, user) => {
      if (!user.organizationId) throw new NotFoundError("No organization");
      requireOrganizationAccess(user, user.organizationId);

      const body = await req.json();
      const input = orgSettingsSchema.parse(body);

      const org = await organizationRepository.findById(user.organizationId);
      if (!org) throw new NotFoundError("Organization not found");

      const current = (org.settings as Record<string, unknown>) ?? {};
      const merged = {
        ...current,
        ...(input.general ? { general: { ...(current.general as object), ...input.general } } : {}),
        ...(input.mail ? { mail: { ...(current.mail as object), ...input.mail } } : {}),
        ...(input.security ? { security: { ...(current.security as object), ...input.security } } : {}),
      };

      if (input.general?.companyName) {
        await organizationRepository.update(user.organizationId, {
          name: input.general.companyName,
          settings: merged,
        });
      } else {
        await organizationRepository.update(user.organizationId, {
          settings: merged,
        });
      }

      return successResponse(merged, "Settings saved");
    },
    { permission: "organizations:update" }
  );
}
