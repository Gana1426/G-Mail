import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { userRepository } from "@/repositories/user.repository";
import { auditLogRepository } from "@/repositories/user.repository";
import { notificationRepository, apiKeyRepository } from "@/repositories/mail.repository";
import { successResponse } from "@/utils/errors";
import { updateProfileSchema, createApiKeySchema } from "@/utils/validation";
import { generateApiKey } from "@/utils/crypto";
import { getPaginationParams, buildPaginationMeta } from "@/utils";

export async function GET(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    const { searchParams } = new URL(req.url);
    const section = searchParams.get("section");

    if (section === "notifications") {
      const notifications = await notificationRepository.findByUser(user.id);
      return successResponse(notifications);
    }

    if (section === "api-keys") {
      const keys = await apiKeyRepository.findByUser(user.id);
      return successResponse(keys);
    }

    const fullUser = await userRepository.findByIdWithRelations(user.id);
    return successResponse(fullUser);
  });
}

export async function PATCH(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    const body = await req.json();
    const input = updateProfileSchema.parse(body);
    const updated = await userRepository.update(user.id, input);
    return successResponse(updated, "Profile updated");
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    const body = await req.json();

    if (body.action === "create-api-key") {
      const input = createApiKeySchema.parse(body);
      const { key, prefix, hash } = generateApiKey();

      await apiKeyRepository.create({
        name: input.name,
        keyHash: hash,
        prefix,
        permissions: input.permissions ?? [],
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        user: { connect: { id: user.id } },
      });

      return successResponse({ key, prefix }, "API key created. Save it now - it won't be shown again.");
    }

    if (body.action === "mark-notifications-read") {
      await notificationRepository.markAllRead(user.id);
      return successResponse(null, "Notifications marked as read");
    }

    return successResponse(null);
  });
}
