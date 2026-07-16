import { prisma } from "@/lib/prisma";
import type { Domain, Prisma } from "@prisma/client";
import { DomainStatus } from "@prisma/client";

export class DomainRepository {
  async findById(id: string): Promise<Domain | null> {
    return prisma.domain.findUnique({ where: { id } });
  }

  async findByName(name: string): Promise<Domain | null> {
    return prisma.domain.findUnique({ where: { name: name.toLowerCase() } });
  }

  async findByOrganization(organizationId: string) {
    return prisma.domain.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  async countByOrganization(organizationId: string): Promise<number> {
    return prisma.domain.count({
      where: { organizationId, status: { not: "SUSPENDED" } },
    });
  }

  async create(data: Prisma.DomainCreateInput): Promise<Domain> {
    return prisma.domain.create({ data });
  }

  async update(id: string, data: Prisma.DomainUpdateInput): Promise<Domain> {
    return prisma.domain.update({ where: { id }, data });
  }

  async verify(id: string): Promise<Domain> {
    return prisma.domain.update({
      where: { id },
      data: {
        status: DomainStatus.VERIFIED,
        verifiedAt: new Date(),
        lastVerifiedAt: new Date(),
      },
    });
  }

  async setStatus(id: string, status: DomainStatus): Promise<Domain> {
    return prisma.domain.update({ where: { id }, data: { status } });
  }

  async suspend(id: string): Promise<Domain> {
    return prisma.domain.update({
      where: { id },
      data: { status: DomainStatus.SUSPENDED },
    });
  }

  async countActiveMailboxes(domainId: string): Promise<number> {
    return prisma.mailbox.count({
      where: {
        domainId,
        status: { not: "DELETED" },
      },
    });
  }

  async setDefaultForOrganization(
    organizationId: string,
    domainId: string
  ): Promise<Domain> {
    await prisma.domain.updateMany({
      where: { organizationId },
      data: { isDefault: false },
    });
    return prisma.domain.update({
      where: { id: domainId },
      data: { isDefault: true },
    });
  }

  async findVerifiedByOrganization(organizationId: string) {
    return prisma.domain.findMany({
      where: { organizationId, status: "VERIFIED" },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  async getLatestVerification(domainId: string) {
    return prisma.domainVerification.findFirst({
      where: { domainId },
      orderBy: { checkedAt: "desc" },
    });
  }

  async delete(id: string): Promise<Domain> {
    return prisma.domain.delete({ where: { id } });
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.DomainWhereInput;
    orderBy?: Prisma.DomainOrderByWithRelationInput;
  }) {
    const [domains, total] = await Promise.all([
      prisma.domain.findMany({
        ...params,
        include: {
          organization: { select: { id: true, name: true } },
          _count: { select: { mailboxes: true } },
        },
      }),
      prisma.domain.count({ where: params.where }),
    ]);
    return { domains, total };
  }

  async updateDnsStatus(
    id: string,
    status: {
      spfStatus?: "VALID" | "INVALID" | "PENDING" | "MISSING";
      dkimStatus?: "VALID" | "INVALID" | "PENDING" | "MISSING";
      dmarcStatus?: "VALID" | "INVALID" | "PENDING" | "MISSING";
      mxStatus?: "VALID" | "INVALID" | "PENDING" | "MISSING";
      aRecordStatus?: "VALID" | "INVALID" | "PENDING" | "MISSING";
      autodiscoverStatus?: "VALID" | "INVALID" | "PENDING" | "MISSING";
      autoconfigStatus?: "VALID" | "INVALID" | "PENDING" | "MISSING";
    }
  ): Promise<Domain> {
    return prisma.domain.update({ where: { id }, data: status });
  }

  async getStats() {
    const [total, verified, pending] = await Promise.all([
      prisma.domain.count(),
      prisma.domain.count({ where: { status: "VERIFIED" } }),
      prisma.domain.count({ where: { status: "PENDING" } }),
    ]);
    return { total, verified, pending };
  }
}

export class DkimKeyRepository {
  async findByDomain(domainId: string) {
    return prisma.dkimKey.findMany({
      where: { domainId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findActive(domainId: string) {
    return prisma.dkimKey.findFirst({
      where: { domainId, isActive: true },
    });
  }

  async create(data: Prisma.DkimKeyCreateInput) {
    return prisma.dkimKey.create({ data });
  }

  async deactivateAll(domainId: string) {
    await prisma.dkimKey.updateMany({
      where: { domainId },
      data: { isActive: false },
    });
  }
}

export const domainRepository = new DomainRepository();
export const dkimKeyRepository = new DkimKeyRepository();
