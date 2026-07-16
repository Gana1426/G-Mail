import { NextRequest } from "next/server";
import { verifyAccessToken, extractBearerToken, hasPermission } from "@/utils/jwt";
import { userRepository } from "@/repositories/user.repository";
import { UnauthorizedError, ForbiddenError } from "@/utils/errors";
import { ROLE_PERMISSIONS } from "@/types";
import type { AuthenticatedUser } from "@/types";
import { UserRole, UserStatus } from "@prisma/client";

export async function authenticateRequest(
  request: NextRequest
): Promise<AuthenticatedUser & { sessionId: string }> {
  const authHeader = request.headers.get("authorization");
  const cookieToken = request.cookies.get("access_token")?.value;
  const token = extractBearerToken(authHeader) ?? cookieToken;

  if (!token) {
    throw new UnauthorizedError("Missing authentication token");
  }

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }

  const user = await userRepository.findById(payload.sub);
  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new UnauthorizedError("User account is not active");
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    organizationId: user.organizationId,
    avatar: user.avatar,
    twoFactorEnabled: user.twoFactorEnabled,
    emailVerified: user.emailVerified,
    sessionId: payload.sessionId,
  };
}

export function requireRole(
  user: AuthenticatedUser,
  ...roles: UserRole[]
): void {
  if (!roles.includes(user.role)) {
    throw new ForbiddenError("Insufficient permissions");
  }
}

export function requirePermission(
  user: AuthenticatedUser,
  permission: string
): void {
  if (!hasPermission(user.role, permission, ROLE_PERMISSIONS)) {
    throw new ForbiddenError("Insufficient permissions");
  }
}

export function requireOrganizationAccess(
  user: AuthenticatedUser,
  organizationId: string
): void {
  if (user.role === UserRole.SUPER_ADMIN) return;
  if (user.organizationId !== organizationId) {
    throw new ForbiddenError("Cannot access this organization");
  }
}

export async function withAuth(
  request: NextRequest,
  handler: (
    request: NextRequest,
    user: AuthenticatedUser & { sessionId: string }
  ) => Promise<Response>,
  options?: { permission?: string; roles?: UserRole[] }
): Promise<Response> {
  try {
    const user = await authenticateRequest(request);

    if (options?.roles) {
      requireRole(user, ...options.roles);
    }

    if (options?.permission) {
      requirePermission(user, options.permission);
    }

    return await handler(request, user);
  } catch (error) {
    const { handleApiError } = await import("@/utils/errors");
    return handleApiError(error);
  }
}
