import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export class MailQueueRepository {
  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.MailQueueWhereInput;
    orderBy?: Prisma.MailQueueOrderByWithRelationInput;
  }) {
    const [items, total] = await Promise.all([
      prisma.mailQueue.findMany(params),
      prisma.mailQueue.count({ where: params.where }),
    ]);
    return { items, total };
  }

  async findById(id: string) {
    return prisma.mailQueue.findUnique({ where: { id } });
  }

  async delete(id: string) {
    return prisma.mailQueue.delete({ where: { id } });
  }

  async retry(id: string) {
    return prisma.mailQueue.update({
      where: { id },
      data: {
        status: "PENDING",
        attempts: 0,
        lastError: null,
        nextRetryAt: null,
      },
    });
  }

  async getStats() {
    const [incoming, outgoing, deferred, failed] = await Promise.all([
      prisma.mailQueue.count({
        where: { direction: "INCOMING", status: { in: ["PENDING", "ACTIVE"] } },
      }),
      prisma.mailQueue.count({
        where: { direction: "OUTGOING", status: { in: ["PENDING", "ACTIVE"] } },
      }),
      prisma.mailQueue.count({ where: { status: "DEFERRED" } }),
      prisma.mailQueue.count({ where: { status: "FAILED" } }),
    ]);
    return { incoming, outgoing, deferred, failed };
  }

  async deleteQueue(status?: string) {
    const where = status ? { status: status as "FAILED" } : {};
    return prisma.mailQueue.deleteMany({ where });
  }
}

export class SpamLogRepository {
  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.SpamLogWhereInput;
    orderBy?: Prisma.SpamLogOrderByWithRelationInput;
  }) {
    const [logs, total] = await Promise.all([
      prisma.spamLog.findMany({
        ...params,
        include: {
          mailbox: { select: { id: true, email: true } },
        },
      }),
      prisma.spamLog.count({ where: params.where }),
    ]);
    return { logs, total };
  }

  async release(id: string) {
    return prisma.spamLog.update({
      where: { id },
      data: { isQuarantined: false, releasedAt: new Date() },
    });
  }

  async delete(id: string) {
    return prisma.spamLog.delete({ where: { id } });
  }

  async getQuarantineCount() {
    return prisma.spamLog.count({ where: { isQuarantined: true } });
  }
}

export class MailLogRepository {
  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.MailLogWhereInput;
    orderBy?: Prisma.MailLogOrderByWithRelationInput;
  }) {
    const [logs, total] = await Promise.all([
      prisma.mailLog.findMany({
        ...params,
        include: {
          mailbox: { select: { id: true, email: true } },
        },
      }),
      prisma.mailLog.count({ where: params.where }),
    ]);
    return { logs, total };
  }
}

export class StorageRepository {
  async recordUsage(data: Prisma.StorageCreateInput) {
    return prisma.storage.create({ data });
  }

  async getOrganizationHistory(organizationId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return prisma.storage.findMany({
      where: {
        organizationId,
        recordedAt: { gte: since },
      },
      orderBy: { recordedAt: "asc" },
    });
  }

  async getMailboxHistory(mailboxId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return prisma.storage.findMany({
      where: {
        mailboxId,
        recordedAt: { gte: since },
      },
      orderBy: { recordedAt: "asc" },
    });
  }
}

export class SettingRepository {
  async findByKey(key: string) {
    return prisma.setting.findUnique({ where: { key } });
  }

  async findByCategory(category: string) {
    return prisma.setting.findMany({ where: { category } });
  }

  async upsert(key: string, value: unknown, category = "general") {
    return prisma.setting.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue, category },
      update: { value: value as Prisma.InputJsonValue },
    });
  }

  async getAll() {
    return prisma.setting.findMany();
  }
}

export class NotificationRepository {
  async findByUser(userId: string, unreadOnly = false) {
    return prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async create(data: Prisma.NotificationCreateInput) {
    return prisma.notification.create({ data });
  }

  async findRecentDuplicate(
    userId: string,
    title: string,
    message: string,
    link: string | null | undefined,
    since: Date
  ) {
    return prisma.notification.findFirst({
      where: {
        userId,
        title,
        message,
        link: link ?? null,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async markRead(id: string) {
    return prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async countUnread(userId: string) {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markReadForUser(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async deleteForUser(id: string, userId: string) {
    return prisma.notification.deleteMany({
      where: { id, userId },
    });
  }
}

export class ApiKeyRepository {
  async findByUser(userId: string) {
    return prisma.apiKey.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        name: true,
        prefix: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  async create(data: Prisma.ApiKeyCreateInput) {
    return prisma.apiKey.create({ data });
  }

  async revoke(id: string) {
    return prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async findByHash(keyHash: string) {
    return prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true },
    });
  }
}

export const mailQueueRepository = new MailQueueRepository();
export const spamLogRepository = new SpamLogRepository();
export const mailLogRepository = new MailLogRepository();
export const storageRepository = new StorageRepository();
export const settingRepository = new SettingRepository();
export const notificationRepository = new NotificationRepository();
export const apiKeyRepository = new ApiKeyRepository();
