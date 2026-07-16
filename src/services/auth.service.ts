import { authenticator } from "otplib";
import QRCode from "qrcode";
import {
  userRepository,
  sessionRepository,
  passwordResetRepository,
  emailVerificationRepository,
  auditLogRepository,
} from "@/repositories/user.repository";
import { organizationRepository } from "@/repositories/organization.repository";
import {
  hashPassword,
  verifyPassword,
  generateSecureToken,
  hashToken,
} from "@/utils/crypto";
import {
  signAccessToken,
  getAccessTokenExpiry,
  getRefreshTokenExpiry,
} from "@/utils/jwt";
import {
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from "@/utils/errors";
import { logAuth } from "@/utils/logger";
import type { AuthTokens, AuthenticatedUser } from "@/types";
import { UserRole, UserStatus } from "@prisma/client";
import type { LoginInput, RegisterInput } from "@/utils/validation";

export class AuthService {
  async login(
    input: LoginInput,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: AuthenticatedUser; tokens: AuthTokens }> {
    const user = await userRepository.findByEmail(input.email);

    if (!user || user.status === UserStatus.DELETED) {
      logAuth("login", input.email, false, ipAddress);
      throw new UnauthorizedError("Invalid email or password");
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedError("Account is suspended");
    }

    if (user.organizationId) {
      const org = await organizationRepository.findById(user.organizationId);
      if (org?.status === "SUSPENDED") {
        throw new UnauthorizedError("Organization is suspended");
      }
      if (org?.status === "DELETED") {
        throw new UnauthorizedError("Organization has been deleted");
      }
    }

    if (user.status === UserStatus.PENDING || !user.emailVerified) {
      throw new UnauthorizedError(
        "Please verify your email before signing in"
      );
    }

    const validPassword = await verifyPassword(input.password, user.passwordHash);
    if (!validPassword) {
      logAuth("login", input.email, false, ipAddress);
      throw new UnauthorizedError("Invalid email or password");
    }

    if (user.twoFactorEnabled) {
      if (!input.twoFactorCode) {
        throw new ValidationError("2FA code required");
      }
      const valid = authenticator.verify({
        token: input.twoFactorCode,
        secret: user.twoFactorSecret!,
      });
      if (!valid) {
        logAuth("login_2fa", input.email, false, ipAddress);
        throw new UnauthorizedError("Invalid 2FA code");
      }
    }

    const tokens = await this.createSession(user.id, ipAddress, userAgent);
    await userRepository.updateLastLogin(user.id);

    logAuth("login", input.email, true, ipAddress);

    await auditLogRepository.create({
      action: "LOGIN",
      resource: "user",
      resourceId: user.id,
      ipAddress,
      userAgent,
      user: { connect: { id: user.id } },
    });

    return {
      user: this.toAuthenticatedUser(user),
      tokens,
    };
  }

  async register(input: RegisterInput, role: UserRole = UserRole.MAIL_USER) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictError("Email already registered");
    }

    const passwordHash = await hashPassword(input.password);

    const user = await userRepository.create({
      email: input.email.toLowerCase(),
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role,
      status: UserStatus.PENDING,
    });

    const verificationToken = generateSecureToken();
    await emailVerificationRepository.create(
      user.id,
      hashToken(verificationToken),
      new Date(Date.now() + 24 * 60 * 60 * 1000)
    );

    return { user, verificationToken };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const session = await sessionRepository.findByRefreshToken(refreshToken);

    if (!session || session.status !== "ACTIVE") {
      throw new UnauthorizedError("Invalid refresh token");
    }

    if (session.expiresAt < new Date()) {
      await sessionRepository.revoke(session.id);
      throw new UnauthorizedError("Refresh token expired");
    }

    const user = await userRepository.findById(session.userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError("Account is not active");
    }

    await sessionRepository.updateLastActive(session.id);

    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId ?? undefined,
      sessionId: session.id,
    });

    return {
      accessToken,
      refreshToken: session.refreshToken,
      expiresIn: getAccessTokenExpiry(),
    };
  }

  async logout(sessionId: string, userId: string): Promise<void> {
    await sessionRepository.revoke(sessionId);
    await auditLogRepository.create({
      action: "LOGOUT",
      resource: "session",
      resourceId: sessionId,
      user: { connect: { id: userId } },
    });
  }

  async logoutAll(userId: string, exceptSessionId?: string): Promise<void> {
    await sessionRepository.revokeAllForUser(userId, exceptSessionId);
  }

  async forgotPassword(email: string): Promise<string> {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      return generateSecureToken();
    }

    const token = generateSecureToken();
    await passwordResetRepository.create(
      user.id,
      hashToken(token),
      new Date(Date.now() + 60 * 60 * 1000)
    );

    return token;
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetToken = await passwordResetRepository.findByToken(hashToken(token));

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new ValidationError("Invalid or expired reset token");
    }

    const passwordHash = await hashPassword(newPassword);
    await userRepository.update(resetToken.userId, { passwordHash });
    await passwordResetRepository.markUsed(resetToken.id);
    await sessionRepository.revokeAllForUser(resetToken.userId);

    await auditLogRepository.create({
      action: "RESET_PASSWORD",
      resource: "user",
      resourceId: resetToken.userId,
      user: { connect: { id: resetToken.userId } },
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError("Current password is incorrect");
    }

    const passwordHash = await hashPassword(newPassword);
    await userRepository.update(userId, { passwordHash });

    await auditLogRepository.create({
      action: "CHANGE_PASSWORD",
      resource: "user",
      resourceId: userId,
      user: { connect: { id: userId } },
    });
  }

  async verifyEmail(token: string): Promise<void> {
    const verification = await emailVerificationRepository.findByToken(
      hashToken(token)
    );

    if (!verification || verification.usedAt || verification.expiresAt < new Date()) {
      throw new ValidationError("Invalid or expired verification token");
    }

    await userRepository.update(verification.userId, {
      emailVerified: true,
      emailVerifiedAt: new Date(),
      status: UserStatus.ACTIVE,
    });
    await emailVerificationRepository.markUsed(verification.id);
  }

  async setup2FA(userId: string): Promise<{ secret: string; qrCode: string }> {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, "MailHost Platform", secret);
    const qrCode = await QRCode.toDataURL(otpauth);

    await userRepository.update(userId, { twoFactorSecret: secret });

    return { secret, qrCode };
  }

  async enable2FA(userId: string, code: string): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user || !user.twoFactorSecret) {
      throw new ValidationError("2FA setup not initiated");
    }

    const valid = authenticator.verify({
      token: code,
      secret: user.twoFactorSecret,
    });

    if (!valid) {
      throw new ValidationError("Invalid 2FA code");
    }

    await userRepository.update(userId, { twoFactorEnabled: true });

    await auditLogRepository.create({
      action: "ENABLE_2FA",
      resource: "user",
      resourceId: userId,
      user: { connect: { id: userId } },
    });
  }

  async disable2FA(userId: string, code: string): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user || !user.twoFactorSecret) {
      throw new NotFoundError("User not found");
    }

    const valid = authenticator.verify({
      token: code,
      secret: user.twoFactorSecret,
    });

    if (!valid) {
      throw new ValidationError("Invalid 2FA code");
    }

    await userRepository.update(userId, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
    });

    await auditLogRepository.create({
      action: "DISABLE_2FA",
      resource: "user",
      resourceId: userId,
      user: { connect: { id: userId } },
    });
  }

  async getSessions(userId: string) {
    return sessionRepository.findByUserId(userId);
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const sessions = await sessionRepository.findByUserId(userId);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) throw new NotFoundError("Session not found");
    await sessionRepository.revoke(sessionId);
  }

  private async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthTokens> {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    const refreshToken = generateSecureToken(48);
    const expiresAt = getRefreshTokenExpiry();

    const session = await sessionRepository.create({
      refreshToken,
      expiresAt,
      ipAddress,
      userAgent,
      user: { connect: { id: userId } },
    });

    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId ?? undefined,
      sessionId: session.id,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: getAccessTokenExpiry(),
    };
  }

  private toAuthenticatedUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    organizationId: string | null;
    avatar: string | null;
    twoFactorEnabled: boolean;
    emailVerified: boolean;
  }): AuthenticatedUser {
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
    };
  }
}

export const authService = new AuthService();
