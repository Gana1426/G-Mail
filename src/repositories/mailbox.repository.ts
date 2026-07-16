import { prisma } from "@/lib/prisma";
import type { Mailbox, Prisma } from "@prisma/client";
import { MailboxStatus } from "@prisma/client";

export class MailboxRepository {
  async findById(id: string): Promise<Mailbox | null> {
    return prisma.mailbox.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<Mailbox | null> {
    return prisma.mailbox.findUnique({ where: { email: email.toLowerCase() } });
  }

  async findByIdWithRelations(id: string) {
    return prisma.mailbox.findUnique({
      where: { id },
      include: {
        domain: true,
        organization: true,
        user: true,
      },
    });
  }

  async create(data: Prisma.MailboxCreateInput): Promise<Mailbox> {
    return prisma.mailbox.create({ data });
  }

  async update(id: string, data: Prisma.MailboxUpdateInput): Promise<Mailbox> {
    return prisma.mailbox.update({ where: { id }, data });
  }

  async suspend(id: string, reason?: string): Promise<Mailbox> {
    return prisma.mailbox.update({
      where: { id },
      data: {
        status: MailboxStatus.SUSPENDED,
        suspendedAt: new Date(),
        suspendedReason: reason,
      },
    });
  }

  async activate(id: string): Promise<Mailbox> {
    return prisma.mailbox.update({
      where: { id },
      data: {
        status: MailboxStatus.ACTIVE,
        suspendedAt: null,
        suspendedReason: null,
      },
    });
  }

  async delete(id: string): Promise<Mailbox> {
    return prisma.mailbox.update({
      where: { id },
      data: { status: MailboxStatus.DELETED },
    });
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.MailboxWhereInput;
    orderBy?: Prisma.MailboxOrderByWithRelationInput;
  }) {
    const [mailboxes, total] = await Promise.all([
      prisma.mailbox.findMany({
        ...params,
        include: {
          domain: { select: { id: true, name: true } },
          organization: { select: { id: true, name: true } },
        },
      }),
      prisma.mailbox.count({ where: params.where }),
    ]);
    return { mailboxes, total };
  }

  async updateUsage(id: string, usedBytes: bigint): Promise<Mailbox> {
    return prisma.mailbox.update({
      where: { id },
      data: { usedBytes },
    });
  }

  async countByOrganization(organizationId: string): Promise<number> {
    return prisma.mailbox.count({
      where: { organizationId, status: { not: "DELETED" } },
    });
  }

  async countActiveByOrganization(organizationId: string): Promise<number> {
    return prisma.mailbox.count({
      where: { organizationId, status: MailboxStatus.ACTIVE },
    });
  }

  async countByDomain(domainId: string): Promise<number> {
    return prisma.mailbox.count({
      where: { domainId, status: { not: "DELETED" } },
    });
  }

  async permanentlyDelete(id: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.alias.deleteMany({ where: { mailboxId: id } });
      await tx.forwarder.deleteMany({
        where: {
          OR: [{ sourceMailboxId: id }, { targetMailboxId: id }],
        },
      });
      await tx.groupMember.deleteMany({ where: { mailboxId: id } });
      await tx.mailbox.delete({ where: { id } });
    });
  }

  async emailExists(email: string): Promise<boolean> {
    const mailbox = await prisma.mailbox.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    return !!mailbox;
  }

  async getStats(organizationId?: string) {
    const where = organizationId ? { organizationId } : {};
    const [total, active, suspended, storage] = await Promise.all([
      prisma.mailbox.count({ where }),
      prisma.mailbox.count({ where: { ...where, status: "ACTIVE" } }),
      prisma.mailbox.count({ where: { ...where, status: "SUSPENDED" } }),
      prisma.mailbox.aggregate({
        where,
        _sum: { quotaBytes: true, usedBytes: true },
      }),
    ]);

    return {
      total,
      active,
      suspended,
      totalQuota: storage._sum.quotaBytes ?? BigInt(0),
      totalUsed: storage._sum.usedBytes ?? BigInt(0),
    };
  }
}

export class AliasRepository {
  async findById(id: string) {
    return prisma.alias.findUnique({ where: { id } });
  }

  async create(data: Prisma.AliasCreateInput) {
    return prisma.alias.create({ data });
  }

  async update(id: string, data: Prisma.AliasUpdateInput) {
    return prisma.alias.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.alias.delete({ where: { id } });
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.AliasWhereInput;
    orderBy?: Prisma.AliasOrderByWithRelationInput;
  }) {
    const [aliases, total] = await Promise.all([
      prisma.alias.findMany({
        ...params,
        include: {
          domain: { select: { id: true, name: true } },
          mailbox: { select: { id: true, email: true } },
        },
      }),
      prisma.alias.count({ where: params.where }),
    ]);
    return { aliases, total };
  }
}

export class ForwarderRepository {
  async findById(id: string) {
    return prisma.forwarder.findUnique({ where: { id } });
  }

  async create(data: Prisma.ForwarderCreateInput) {
    return prisma.forwarder.create({ data });
  }

  async update(id: string, data: Prisma.ForwarderUpdateInput) {
    return prisma.forwarder.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.forwarder.delete({ where: { id } });
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.ForwarderWhereInput;
    orderBy?: Prisma.ForwarderOrderByWithRelationInput;
  }) {
    const [forwarders, total] = await Promise.all([
      prisma.forwarder.findMany({
        ...params,
        include: {
          domain: { select: { id: true, name: true } },
          sourceMailbox: { select: { id: true, email: true } },
          targetMailbox: { select: { id: true, email: true } },
        },
      }),
      prisma.forwarder.count({ where: params.where }),
    ]);
    return { forwarders, total };
  }
}

export const mailboxRepository = new MailboxRepository();
export const aliasRepository = new AliasRepository();
export const forwarderRepository = new ForwarderRepository();
