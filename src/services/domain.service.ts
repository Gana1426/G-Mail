import { prisma } from "@/lib/prisma";
import {
  domainRepository,
  dkimKeyRepository,
} from "@/repositories/domain.repository";
import { domainVerificationRepository } from "@/repositories/dns-record.repository";
import { organizationRepository } from "@/repositories/organization.repository";
import { auditLogRepository } from "@/repositories/user.repository";
import { dnsService } from "@/services/dns.service";
import { dnsRecordsService } from "@/services/dns-records.service";
import { encrypt } from "@/utils/crypto";
import { generateVerificationToken } from "@/utils";
import { planEnforcementService } from "@/services/plan-enforcement.service";
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from "@/utils/errors";
import type { CreateDomainInput } from "@/utils/validation";
import type { AuthenticatedUser, DnsCheckResult, DnsRecordItem } from "@/types";

export class DomainService {
  async create(
    organizationId: string,
    input: CreateDomainInput,
    createdBy: AuthenticatedUser
  ) {
    const org = await organizationRepository.findById(organizationId);
    if (!org) throw new NotFoundError("Organization not found");

    if (
      createdBy.role !== "SUPER_ADMIN" &&
      createdBy.organizationId !== organizationId
    ) {
      throw new ForbiddenError("Cannot add domain to this organization");
    }

    await planEnforcementService.assertCanCreateDomain(organizationId);

    const existingDomains = await domainRepository.findByOrganization(organizationId);
    const name = input.name.toLowerCase();
    const existing = await domainRepository.findByName(name);
    if (existing) throw new ConflictError("Domain already exists");

    const verificationToken = generateVerificationToken();
    const dkimKeys = dnsRecordsService.generateDkimKeys("mail");
    const mailHost = dnsRecordsService.getMailHost(name);
    const spfRecord = dnsRecordsService.generateSpfRecord();
    const dmarcRecord = dnsRecordsService.generateDmarcRecord(name);

    const result = await prisma.$transaction(async (tx) => {
      const domain = await tx.domain.create({
        data: {
          name,
          verificationToken,
          isDefault: input.isDefault ?? existingDomains.length === 0,
          dkimSelector: dkimKeys.selector,
          dkimPrivateKey: encrypt(dkimKeys.privateKey),
          dkimPublicKey: dkimKeys.publicKey,
          spfRecord,
          dmarcRecord,
          mxRecord: mailHost,
          organizationId,
        },
      });

      await tx.dkimKey.create({
        data: {
          selector: dkimKeys.selector,
          privateKey: encrypt(dkimKeys.privateKey),
          publicKey: dkimKeys.publicKey,
          domainId: domain.id,
        },
      });

      const dnsRecords = dnsRecordsService.buildRecords(domain);
      await tx.dnsRecord.deleteMany({ where: { domainId: domain.id } });
      await tx.dnsRecord.createMany({
        data: dnsRecords.map((r) => ({
          domainId: domain.id,
          type: r.type,
          host: r.host,
          value: r.value,
          priority: r.priority ?? null,
          ttl: r.ttl,
          status: "PENDING",
        })),
      });

      return { domain, dnsRecords };
    });

    await auditLogRepository.create({
      action: "CREATE",
      resource: "domain",
      resourceId: result.domain.id,
      description: `Added domain: ${name}`,
      user: { connect: { id: createdBy.id } },
      organization: { connect: { id: organizationId } },
    });

    return {
      ...result.domain,
      dnsRecords: result.dnsRecords,
    };
  }

  async getById(id: string) {
    const domain = await domainRepository.findById(id);
    if (!domain) throw new NotFoundError("Domain not found");
    return domain;
  }

  async getDnsRecords(id: string): Promise<DnsRecordItem[]> {
    const domain = await this.getById(id);
    return dnsRecordsService.getOrGenerateRecords(domain);
  }

  async list(params: {
    skip: number;
    take: number;
    organizationId?: string;
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    const where = {
      ...(params.organizationId
        ? { organizationId: params.organizationId }
        : {}),
      ...(params.status
        ? {
            status: params.status as
              | "PENDING"
              | "VERIFYING"
              | "VERIFIED"
              | "FAILED"
              | "SUSPENDED",
          }
        : {}),
      ...(params.search
        ? { name: { contains: params.search, mode: "insensitive" as const } }
        : {}),
    };

    return domainRepository.findMany({
      skip: params.skip,
      take: params.take,
      where,
      orderBy: { [params.sortBy ?? "createdAt"]: params.sortOrder ?? "desc" },
    });
  }

  async verify(id: string, verifiedBy: AuthenticatedUser) {
    const domain = await domainRepository.findById(id);
    if (!domain) throw new NotFoundError("Domain not found");

    await planEnforcementService.assertOrganizationActive(domain.organizationId);

    await domainRepository.setStatus(id, "VERIFYING");

    const dnsCheck = await this.checkDns(domain.name, domain);
    const allValid = dnsRecordsService.isFullyVerified(dnsCheck);
    const progress = dnsRecordsService.countVerified(dnsCheck);

    await domainRepository.updateDnsStatus(id, {
      mxStatus: dnsCheck.mx.status,
      aRecordStatus: dnsCheck.a.status,
      spfStatus: dnsCheck.spf.status,
      dkimStatus: dnsCheck.dkim.status,
      dmarcStatus: dnsCheck.dmarc.status,
      autodiscoverStatus: dnsCheck.autodiscover.status,
      autoconfigStatus: dnsCheck.autoconfig.status,
    });

    const dnsRecords = await dnsRecordsService.syncStatusesFromCheck(
      id,
      domain,
      dnsCheck
    );

    const hasInvalid = Object.values(dnsCheck).some(
      (c) => c.status === "INVALID"
    );
    const nextStatus = allValid ? "VERIFIED" : hasInvalid ? "FAILED" : "PENDING";

    const verification = await domainVerificationRepository.create({
      domain: { connect: { id } },
      status: allValid ? "VERIFIED" : "PENDING",
      results: dnsCheck as object,
    });

    if (!allValid) {
      await domainRepository.setStatus(id, nextStatus);
      return {
        domain: { ...domain, status: nextStatus },
        dnsCheck,
        dnsRecords,
        verified: false,
        progress,
        lastVerificationAt: verification.checkedAt,
        message: "Some DNS records are missing or incorrect",
      };
    }

    const verified = await domainRepository.verify(id);

    await organizationRepository.activate(domain.organizationId);

    await auditLogRepository.create({
      action: "VERIFY",
      resource: "domain",
      resourceId: id,
      user: { connect: { id: verifiedBy.id } },
      organization: { connect: { id: domain.organizationId } },
    });

    return {
      domain: verified,
      dnsCheck,
      dnsRecords,
      verified: true,
      progress,
      lastVerificationAt: verification.checkedAt,
      message: "Domain verified successfully",
    };
  }

  async getVerificationStatus(id: string) {
    const domain = await this.getById(id);
    const dnsCheck = await this.checkDns(domain.name, domain);
    const dnsRecords = await dnsRecordsService.getOrGenerateRecords(domain);
    const progress = dnsRecordsService.countVerified(dnsCheck);
    const lastVerification =
      await domainVerificationRepository.findLatestByDomain(id);

    return {
      domain,
      dnsCheck,
      dnsRecords,
      progress,
      lastVerificationAt: lastVerification?.checkedAt ?? null,
    };
  }

  async getDeleteEligibility(id: string) {
    const domain = await domainRepository.findById(id);
    if (!domain) throw new NotFoundError("Domain not found");

    const mailboxCount = await domainRepository.countActiveMailboxes(id);
    const canDelete =
      domain.status === "PENDING" ||
      domain.status === "FAILED" ||
      mailboxCount === 0;

    return {
      canDelete,
      mailboxCount,
      domainStatus: domain.status,
      reason: canDelete
        ? null
        : `This domain has ${mailboxCount} mailbox(es). Remove all mailboxes before deleting.`,
    };
  }

  async delete(id: string, deletedBy: AuthenticatedUser) {
    const domain = await domainRepository.findById(id);
    if (!domain) throw new NotFoundError("Domain not found");

    const eligibility = await this.getDeleteEligibility(id);
    if (!eligibility.canDelete) {
      throw new ForbiddenError(
        eligibility.reason ?? "Cannot delete this domain"
      );
    }

    await domainRepository.delete(id);

    await auditLogRepository.create({
      action: "DELETE",
      resource: "domain",
      resourceId: id,
      user: { connect: { id: deletedBy.id } },
      organization: { connect: { id: domain.organizationId } },
    });
  }

  async suspend(id: string, suspendedBy: AuthenticatedUser) {
    const domain = await domainRepository.findById(id);
    if (!domain) throw new NotFoundError("Domain not found");

    const suspended = await domainRepository.suspend(id);

    await auditLogRepository.create({
      action: "SUSPEND",
      resource: "domain",
      resourceId: id,
      user: { connect: { id: suspendedBy.id } },
      organization: { connect: { id: domain.organizationId } },
    });

    return suspended;
  }

  async setDefault(id: string, updatedBy: AuthenticatedUser) {
    const domain = await domainRepository.findById(id);
    if (!domain) throw new NotFoundError("Domain not found");

    if (domain.status !== "VERIFIED") {
      throw new ForbiddenError("Only verified domains can be set as default");
    }

    const updated = await domainRepository.setDefaultForOrganization(
      domain.organizationId,
      id
    );

    await auditLogRepository.create({
      action: "UPDATE",
      resource: "domain",
      resourceId: id,
      description: `Set ${domain.name} as default domain`,
      user: { connect: { id: updatedBy.id } },
      organization: { connect: { id: domain.organizationId } },
    });

    return updated;
  }

  async regenerateDns(id: string, regeneratedBy: AuthenticatedUser) {
    const domain = await domainRepository.findById(id);
    if (!domain) throw new NotFoundError("Domain not found");

    const newSelector = `mail${Date.now()}`;
    const dkimKeys = dnsRecordsService.generateDkimKeys(newSelector);

    await dkimKeyRepository.deactivateAll(id);
    await dkimKeyRepository.create({
      selector: dkimKeys.selector,
      privateKey: encrypt(dkimKeys.privateKey),
      publicKey: dkimKeys.publicKey,
      domain: { connect: { id } },
    });

    const now = new Date();
    const updated = await domainRepository.update(id, {
      dkimSelector: dkimKeys.selector,
      dkimPrivateKey: encrypt(dkimKeys.privateKey),
      dkimPublicKey: dkimKeys.publicKey,
      dkimRotatedAt: now,
      spfRecord: dnsRecordsService.generateSpfRecord(),
      dmarcRecord: dnsRecordsService.generateDmarcRecord(domain.name),
      mxRecord: dnsRecordsService.getMailHost(domain.name),
      spfStatus: "PENDING",
      dkimStatus: "PENDING",
      dmarcStatus: "PENDING",
      mxStatus: "PENDING",
      aRecordStatus: "PENDING",
      autodiscoverStatus: "PENDING",
      autoconfigStatus: "PENDING",
      status: "PENDING",
      verifiedAt: null,
      lastVerifiedAt: null,
      dnsGeneratedAt: now,
    });

    const dnsRecords = dnsRecordsService.buildRecords(updated);
    await dnsRecordsService.saveRecords(id, dnsRecords);

    await auditLogRepository.create({
      action: "UPDATE",
      resource: "domain",
      resourceId: id,
      description: "DNS records regenerated",
      user: { connect: { id: regeneratedBy.id } },
      organization: { connect: { id: domain.organizationId } },
    });

    return {
      domain: updated,
      dnsRecords,
      message: "DNS Records regenerated successfully.",
      generatedAt: now,
    };
  }

  async listVerified(organizationId: string) {
    return domainRepository.findVerifiedByOrganization(organizationId);
  }

  async checkDns(
    domainName: string,
    domain?: {
      spfRecord: string | null;
      dkimPublicKey: string | null;
      dkimSelector: string;
      dmarcRecord: string | null;
      mxRecord: string | null;
    }
  ): Promise<DnsCheckResult> {
    const mailHost = dnsRecordsService.resolveMailHost(
      domainName,
      domain?.mxRecord
    );
    const expectedSpf =
      domain?.spfRecord ?? dnsRecordsService.generateSpfRecord();
    const expectedDmarc =
      domain?.dmarcRecord ?? dnsRecordsService.generateDmarcRecord(domainName);
    const serverIp = dnsRecordsService.getServerIp();

    const [mx, a, spf, dkim, dmarc, autodiscover, autoconfig] =
      await Promise.all([
        dnsService.checkMx(domainName, mailHost, 10),
        dnsService.checkA(mailHost, serverIp),
        dnsService.checkTxt(domainName, expectedSpf),
        domain?.dkimPublicKey
          ? dnsService.checkDkim(
              domainName,
              domain.dkimSelector,
              domain.dkimPublicKey
            )
          : Promise.resolve({
              status: "MISSING" as const,
              expected: `mail._domainkey.${domainName}`,
              actual: null,
              message: "DKIM keys not configured",
            }),
        dnsService.checkDmarc(`_dmarc.${domainName}`, expectedDmarc),
        dnsService.checkCname(`autodiscover.${domainName}`, mailHost),
        dnsService.checkCname(`autoconfig.${domainName}`, mailHost),
      ]);

    return { mx, a, spf, dkim, dmarc, autodiscover, autoconfig };
  }

  async rotateDkim(id: string, rotatedBy: AuthenticatedUser) {
    const domain = await domainRepository.findById(id);
    if (!domain) throw new NotFoundError("Domain not found");

    const selector = `mail${Date.now()}`;
    const dkimKeys = dnsRecordsService.generateDkimKeys(selector);

    await dkimKeyRepository.deactivateAll(id);

    await dkimKeyRepository.create({
      selector: dkimKeys.selector,
      privateKey: encrypt(dkimKeys.privateKey),
      publicKey: dkimKeys.publicKey,
      domain: { connect: { id } },
    });

    const updated = await domainRepository.update(id, {
      dkimSelector: dkimKeys.selector,
      dkimPrivateKey: encrypt(dkimKeys.privateKey),
      dkimPublicKey: dkimKeys.publicKey,
      dkimRotatedAt: new Date(),
      dkimStatus: "PENDING",
    });

    const dnsRecords = dnsRecordsService.buildRecords(updated);
    await dnsRecordsService.saveRecords(id, dnsRecords);

    await auditLogRepository.create({
      action: "UPDATE",
      resource: "dkim",
      resourceId: id,
      description: "DKIM keys rotated",
      user: { connect: { id: rotatedBy.id } },
      organization: { connect: { id: domain.organizationId } },
    });

    return { domain: updated, dnsRecord: dkimKeys.dnsRecord, dnsRecords };
  }

  generateDmarcRecord(
    domain: string,
    policy: "none" | "quarantine" | "reject" = "none",
    percentage = 100,
    rua?: string,
    ruf?: string
  ): string {
    if (rua || ruf || percentage !== 100 || policy !== "none") {
      const parts = [`v=DMARC1`, `p=${policy}`, `pct=${percentage}`];
      if (rua) parts.push(`rua=mailto:${rua}`);
      if (ruf) parts.push(`ruf=mailto:${ruf}`);
      parts.push(`sp=${policy}`);
      return parts.join("; ");
    }
    return dnsRecordsService.generateDmarcRecord(domain);
  }

  async setCatchAll(
    id: string,
    enabled: boolean,
    mailboxId: string | undefined,
    updatedBy: AuthenticatedUser
  ) {
    const domain = await domainRepository.findById(id);
    if (!domain) throw new NotFoundError("Domain not found");

    if (enabled && !mailboxId) {
      throw new ForbiddenError("Mailbox required for catch-all");
    }

    return domainRepository.update(id, {
      catchAllEnabled: enabled,
      ...(enabled && mailboxId
        ? { catchAllMailbox: { connect: { id: mailboxId } } }
        : { catchAllMailbox: { disconnect: true } }),
    });
  }

  async getStats() {
    return domainRepository.getStats();
  }
}

export const domainService = new DomainService();
