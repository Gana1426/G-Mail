import { NextRequest } from "next/server";
import { verifyMailSessionToken } from "@mail-portal/lib/jwt";
import { MAIL_SESSION_COOKIE } from "@mail-portal/lib/constants";
import { mailSessionRepository } from "@mail-portal/repositories/mail.repository";
import { decrypt } from "@/utils/crypto";
import { hashToken } from "@/utils/crypto";
import { UnauthorizedError } from "@/utils/errors";
import type { MailSessionContext } from "@mail-portal/types/mail";

export async function authenticateMailRequest(
  request: NextRequest
): Promise<MailSessionContext> {
  const token =
    request.cookies.get(MAIL_SESSION_COOKIE)?.value ??
    request.headers.get("x-mail-session");

  if (!token) {
    throw new UnauthorizedError("Mail session required");
  }

  let payload;
  try {
    payload = await verifyMailSessionToken(token);
  } catch {
    throw new UnauthorizedError("Invalid or expired mail session");
  }

  const tokenHash = hashToken(token);
  const session = await mailSessionRepository.findByTokenHash(tokenHash);

  if (!session || session.expiresAt < new Date()) {
    throw new UnauthorizedError("Mail session expired");
  }

  if (session.mailbox.status !== "ACTIVE") {
    throw new UnauthorizedError("Mailbox is not active");
  }

  const password = decrypt(session.encryptedSecret);
  const maildirPath =
    session.mailbox.maildirPath ??
    `${session.mailbox.domain.name}/${session.mailbox.localPart}`;

  await mailSessionRepository.touch(session.id);

  return {
    sessionId: session.id,
    mailboxId: session.mailboxId,
    email: session.mailbox.email,
    displayName: session.mailbox.displayName,
    maildirPath,
    password,
  };
}

export async function withMailAuth(
  request: NextRequest,
  handler: (
    request: NextRequest,
    session: MailSessionContext
  ) => Promise<Response>
): Promise<Response> {
  try {
    const session = await authenticateMailRequest(request);
    return await handler(request, session);
  } catch (error) {
    const { handleApiError } = await import("@/utils/errors");
    return handleApiError(error);
  }
}
