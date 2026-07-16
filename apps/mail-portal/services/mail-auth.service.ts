import { NextResponse } from "next/server";
import { mailProvisionService } from "@/services/mail-provision.service";
import { verifyPassword, encrypt, hashToken, generateSecureToken } from "@/utils/crypto";
import { UnauthorizedError, ValidationError } from "@/utils/errors";
import { signMailSessionToken } from "@mail-portal/lib/jwt";
import {
  MAIL_SESSION_COOKIE,
  MAIL_SESSION_EXPIRY_HOURS,
} from "@mail-portal/lib/constants";
import {
  mailPortalMailboxRepository,
  mailSessionRepository,
  mailPreferenceRepository,
} from "@mail-portal/repositories/mail.repository";
import { mailNotificationService } from "@mail-portal/services/mail-notification.service";
import { imapService } from "@mail-portal/services/imap.service";
import type { MailSessionContext } from "@mail-portal/types/mail";

export class MailAuthService {
  async login(params: {
    email: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const email = params.email.trim().toLowerCase();
    if (!email || !params.password) {
      throw new ValidationError("Email and password are required");
    }

    const mailbox = await mailPortalMailboxRepository.findByEmail(email);
    if (!mailbox || mailbox.status !== "ACTIVE") {
      void mailNotificationService.notifyLoginFailure(null, email);
      throw new UnauthorizedError("Invalid email or password");
    }

    const valid = await verifyPassword(params.password, mailbox.passwordHash);
    if (!valid) {
      void mailNotificationService.notifyLoginFailure(mailbox.id, email);
      throw new UnauthorizedError("Invalid email or password");
    }

    const imapOk = await imapService.testConnection(email, params.password);
    if (!imapOk && process.env.NODE_ENV === "production" && process.env.MAIL_REQUIRE_IMAP !== "false") {
      throw new UnauthorizedError(
        "Unable to connect to mail server. Check your credentials."
      );
    }

    const maildirPath =
      mailbox.maildirPath ??
      mailProvisionService.getMaildirPath(
        mailbox.domain.name,
        mailbox.localPart
      );

    const expiresAt = new Date(
      Date.now() + MAIL_SESSION_EXPIRY_HOURS * 60 * 60 * 1000
    );

    const session = await mailSessionRepository.create({
      mailbox: { connect: { id: mailbox.id } },
      tokenHash: hashToken(generateSecureToken(16)),
      encryptedSecret: encrypt(params.password),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      deviceInfo: params.userAgent?.slice(0, 120),
      expiresAt,
    });

    const jwt = await signMailSessionToken({
      sub: mailbox.id,
      mailboxId: mailbox.id,
      email: mailbox.email,
      sessionId: session.id,
    });

    await mailSessionRepository.updateTokenHash(session.id, hashToken(jwt));

    await mailPortalMailboxRepository.updateLastLogin(mailbox.id);
    await mailPreferenceRepository.upsert(mailbox.id, {});

    void mailNotificationService.notifyLoginSuccess(mailbox.id, mailbox.email);

    return {
      jwt,
      sessionId: session.id,
      mailbox: {
        id: mailbox.id,
        email: mailbox.email,
        displayName: mailbox.displayName,
        maildirPath,
      },
    };
  }

  buildSessionCookie(jwt: string): string {
    const maxAge = MAIL_SESSION_EXPIRY_HOURS * 60 * 60;
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    return `${MAIL_SESSION_COOKIE}=${jwt}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
  }

  clearSessionCookie(): string {
    return `${MAIL_SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0`;
  }

  async logout(sessionId: string) {
    await mailSessionRepository.revoke(sessionId);
  }

  resolveMaildirPath(session: MailSessionContext, domain: string, localPart: string) {
    if (session.maildirPath.includes("/") || session.maildirPath.includes("\\")) {
      return session.maildirPath;
    }
    return mailProvisionService.getMaildirPath(domain, localPart);
  }
}

export const mailAuthService = new MailAuthService();

export function setMailSessionResponse<T>(
  data: T,
  jwt: string,
  message?: string
): NextResponse {
  const response = NextResponse.json({
    success: true,
    data,
    message,
  });
  response.headers.set("Set-Cookie", mailAuthService.buildSessionCookie(jwt));
  return response;
}

export function clearMailSessionResponse(): NextResponse {
  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.headers.set("Set-Cookie", mailAuthService.clearSessionCookie());
  return response;
}
