import { prisma } from "@/lib/prisma";
import type { User, Session, Prisma } from "@prisma/client";
import { UserRole, UserStatus } from "@prisma/client";

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  async findByIdWithRelations(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        organization: true,
        mailbox: { include: { domain: true } },
      },
    });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({ data });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return prisma.user.update({ where: { id }, data });
  }

  async delete(id: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { status: UserStatus.DELETED },
    });
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }) {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        ...params,
        include: { organization: true },
      }),
      prisma.user.count({ where: params.where }),
    ]);
    return { users, total };
  }

  async updateLastLogin(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }
}

export class SessionRepository {
  async create(data: Prisma.SessionCreateInput): Promise<Session> {
    return prisma.session.create({ data });
  }

  async findByRefreshToken(refreshToken: string): Promise<Session | null> {
    return prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });
  }

  async findByUserId(userId: string): Promise<Session[]> {
    return prisma.session.findMany({
      where: { userId, status: "ACTIVE" },
      orderBy: { lastActiveAt: "desc" },
    });
  }

  async revoke(id: string): Promise<Session> {
    return prisma.session.update({
      where: { id },
      data: { status: "REVOKED" },
    });
  }

  async revokeAllForUser(userId: string, exceptId?: string): Promise<void> {
    await prisma.session.updateMany({
      where: {
        userId,
        status: "ACTIVE",
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { status: "REVOKED" },
    });
  }

  async updateLastActive(id: string): Promise<void> {
    await prisma.session.update({
      where: { id },
      data: { lastActiveAt: new Date() },
    });
  }

  async deleteExpired(): Promise<number> {
    const result = await prisma.session.updateMany({
      where: {
        expiresAt: { lt: new Date() },
        status: "ACTIVE",
      },
      data: { status: "EXPIRED" },
    });
    return result.count;
  }
}

export class PasswordResetRepository {
  async create(userId: string, token: string, expiresAt: Date) {
    await prisma.passwordResetToken.deleteMany({ where: { userId } });
    return prisma.passwordResetToken.create({
      data: { userId, token, expiresAt },
    });
  }

  async findByToken(token: string) {
    return prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });
  }

  async markUsed(id: string): Promise<void> {
    await prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }
}

export class EmailVerificationRepository {
  async create(userId: string, token: string, expiresAt: Date) {
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    return prisma.emailVerificationToken.create({
      data: { userId, token, expiresAt },
    });
  }

  async findByToken(token: string) {
    return prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });
  }

  async markUsed(id: string): Promise<void> {
    await prisma.emailVerificationToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }
}

export class AuditLogRepository {
  async create(data: Prisma.AuditLogCreateInput) {
    return prisma.auditLog.create({ data });
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.AuditLogWhereInput;
    orderBy?: Prisma.AuditLogOrderByWithRelationInput;
  }) {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        ...params,
        include: { user: true, organization: true },
      }),
      prisma.auditLog.count({ where: params.where }),
    ]);
    return { logs, total };
  }
}

export const userRepository = new UserRepository();
export const sessionRepository = new SessionRepository();
export const passwordResetRepository = new PasswordResetRepository();
export const emailVerificationRepository = new EmailVerificationRepository();
export const auditLogRepository = new AuditLogRepository();
