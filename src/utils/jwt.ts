import { SignJWT, jwtVerify } from "jose";
import { config } from "@/config";
import { parseExpiry } from "@/utils";
import type { JwtPayload } from "@/types";
import { UserRole } from "@prisma/client";

const secret = new TextEncoder().encode(config.jwt.secret);

export async function signAccessToken(payload: Omit<JwtPayload, "iat" | "exp">): Promise<string> {
  const expiresIn = parseExpiry(config.jwt.accessExpiry);

  return new SignJWT({
    sub: payload.sub,
    email: payload.email,
    role: payload.role,
    organizationId: payload.organizationId,
    sessionId: payload.sessionId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, secret);
  return {
    sub: payload.sub as string,
    email: payload.email as string,
    role: payload.role as UserRole,
    organizationId: payload.organizationId as string | undefined,
    sessionId: payload.sessionId as string,
    iat: payload.iat,
    exp: payload.exp,
  };
}

export function getAccessTokenExpiry(): number {
  return parseExpiry(config.jwt.accessExpiry);
}

export function getRefreshTokenExpiry(): Date {
  const seconds = parseExpiry(config.jwt.refreshExpiry);
  return new Date(Date.now() + seconds * 1000);
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function hasPermission(
  userRole: UserRole,
  requiredPermission: string,
  rolePermissions: Record<UserRole, string[]>
): boolean {
  const permissions = rolePermissions[userRole] ?? [];

  return permissions.some((perm) => {
    if (perm === requiredPermission) return true;
    const [resource, action] = perm.split(":");
    const [reqResource, reqAction] = requiredPermission.split(":");
    if (resource === reqResource && action === "*") return true;
    if (perm === "*") return true;
    return false;
  });
}
