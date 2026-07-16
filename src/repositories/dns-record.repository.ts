import { prisma } from "@/lib/prisma";
import type { DnsRecord, Prisma } from "@prisma/client";
import type { DnsRecordStatus } from "@prisma/client";

export class DnsRecordRepository {
  async findByDomain(domainId: string): Promise<DnsRecord[]> {
    try {
      return await prisma.dnsRecord.findMany({
        where: { domainId },
        orderBy: [{ type: "asc" }, { host: "asc" }],
      });
    } catch {
      return [];
    }
  }

  async createMany(data: Prisma.DnsRecordCreateManyInput[]): Promise<void> {
    if (data.length === 0) return;
    await prisma.dnsRecord.createMany({ data });
  }

  async deleteByDomain(domainId: string): Promise<void> {
    try {
      await prisma.dnsRecord.deleteMany({ where: { domainId } });
    } catch {
      // Table may not exist until migration is applied
    }
  }

  async updateStatus(id: string, status: DnsRecordStatus): Promise<void> {
    await prisma.dnsRecord.update({
      where: { id },
      data: { status },
    });
  }
}

export class DomainVerificationRepository {
  async create(data: Prisma.DomainVerificationCreateInput) {
    return prisma.domainVerification.create({ data });
  }

  async findLatestByDomain(domainId: string) {
    try {
      return await prisma.domainVerification.findFirst({
        where: { domainId },
        orderBy: { checkedAt: "desc" },
      });
    } catch {
      return null;
    }
  }
}

export const dnsRecordRepository = new DnsRecordRepository();
export const domainVerificationRepository = new DomainVerificationRepository();
