import { prisma } from "@/lib/prisma";
import type { Organization, Prisma } from "@prisma/client";
import { OrganizationStatus } from "@prisma/client";

export class OrganizationRepository {
  async findById(id: string): Promise<Organization | null> {
    return prisma.organization.findUnique({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    return prisma.organization.findUnique({ where: { slug } });
  }

  async findByIdWithStats(id: string) {
    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        plan: true,
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
            lastLoginAt: true,
          },
        },
        _count: {
          select: {
            domains: true,
            mailboxes: true,
            users: true,
            aliases: true,
            forwarders: true,
          },
        },
      },
    });
    return org;
  }

  async findByIdWithPlan(id: string) {
    return prisma.organization.findUnique({
      where: { id },
      include: { plan: true },
    });
  }

  async findByIdWithDetails(id: string) {
    return prisma.organization.findUnique({
      where: { id },
      include: {
        plan: true,
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
            lastLoginAt: true,
            twoFactorEnabled: true,
          },
        },
        domains: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            name: true,
            status: true,
            verifiedAt: true,
            createdAt: true,
          },
        },
        mailboxes: {
          where: { status: { not: "DELETED" } },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            email: true,
            status: true,
            usedBytes: true,
            quotaBytes: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            domains: true,
            mailboxes: true,
            aliases: true,
            forwarders: true,
            users: true,
          },
        },
      },
    });
  }

  async create(data: Prisma.OrganizationCreateInput): Promise<Organization> {
    return prisma.organization.create({ data });
  }

  async update(
    id: string,
    data: Prisma.OrganizationUpdateInput
  ): Promise<Organization> {
    return prisma.organization.update({ where: { id }, data });
  }

  async suspend(id: string, reason?: string): Promise<Organization> {
    return prisma.organization.update({
      where: { id },
      data: {
        status: OrganizationStatus.SUSPENDED,
        suspendedAt: new Date(),
        suspendedReason: reason,
      },
    });
  }

  async activate(id: string): Promise<Organization> {
    return prisma.organization.update({
      where: { id },
      data: {
        status: OrganizationStatus.ACTIVE,
        suspendedAt: null,
        suspendedReason: null,
      },
    });
  }

  async delete(id: string): Promise<Organization> {
    return prisma.organization.update({
      where: { id },
      data: { status: OrganizationStatus.DELETED },
    });
  }

  async permanentlyDelete(id: string): Promise<void> {
    await prisma.organization.delete({ where: { id } });
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.OrganizationWhereInput;
    orderBy?: Prisma.OrganizationOrderByWithRelationInput;
  }) {
    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        ...params,
        include: {
          plan: { select: { id: true, name: true, tier: true, code: true } },
          _count: {
            select: { domains: true, mailboxes: true, users: true },
          },
        },
      }),
      prisma.organization.count({ where: params.where }),
    ]);
    return { organizations, total };
  }

  async getStats() {
    const [total, active, suspended, storage] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { status: "ACTIVE" } }),
      prisma.organization.count({ where: { status: "SUSPENDED" } }),
      prisma.organization.aggregate({
        _sum: { storageUsed: true, storageQuota: true },
      }),
    ]);

    return {
      total,
      active,
      suspended,
      totalStorage: storage._sum.storageQuota ?? BigInt(0),
      usedStorage: storage._sum.storageUsed ?? BigInt(0),
    };
  }
}

export const organizationRepository = new OrganizationRepository();
