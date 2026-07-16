import { SignJWT, jwtVerify } from "jose";
import { config } from "@/config";

const secret = new TextEncoder().encode(config.jwt.secret);

export interface MailJwtPayload {
  sub: string;
  mailboxId: string;
  email: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export async function signMailSessionToken(
  payload: Omit<MailJwtPayload, "iat" | "exp">,
  expiresInSeconds = 12 * 60 * 60
): Promise<string> {
  return new SignJWT({
    sub: payload.sub,
    mailboxId: payload.mailboxId,
    email: payload.email,
    sessionId: payload.sessionId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expiresInSeconds}s`)
    .sign(secret);
}

export async function verifyMailSessionToken(
  token: string
): Promise<MailJwtPayload> {
  const { payload } = await jwtVerify(token, secret);
  return {
    sub: payload.sub as string,
    mailboxId: payload.mailboxId as string,
    email: payload.email as string,
    sessionId: payload.sessionId as string,
    iat: payload.iat,
    exp: payload.exp,
  };
}
