import {
  mailboxRepository,
  aliasRepository,
  forwarderRepository,
} from "@/repositories/mailbox.repository";
import { domainRepository } from "@/repositories/domain.repository";
import { organizationRepository } from "@/repositories/organization.repository";
import { userRepository, auditLogRepository } from "@/repositories/user.repository";
import { mailProvisionService } from "@/services/mail-provision.service";
import { hashPassword } from "@/utils/crypto";
import { planEnforcementService } from "@/services/plan-enforcement.service";
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from "@/utils/errors";
import type {
  CreateMailboxInput,
  UpdateMailboxInput,
  CreateAliasInput,
  CreateForwarderInput,
  VacationInput,
} from "@/utils/validation";

import type { AuthenticatedUser } from "@/types";
import { UserRole, UserStatus } from "@prisma/client";
import { config } from "@/config";

export class MailboxService {
  async checkEmailAvailable(email: string): Promise<boolean> {
    const exists = await mailboxRepository.emailExists(email);
    return !exists;
  }

  async create(
    organizationId: string,
    input: CreateMailboxInput,
    createdBy: AuthenticatedUser
  ) {
    const org = await organizationRepository.findById(organizationId);
    if (!org) throw new NotFoundError("Organization not found");

    const domain = await domainRepository.findById(input.domainId);
    if (!domain || domain.organizationId !== organizationId) {
      throw new NotFoundError("Domain not found");
    }

    if (domain.status !== "VERIFIED") {
      throw new ForbiddenError("Domain must be verified before creating mailboxes");
    }

    await planEnforcementService.assertCanCreateMailbox(
      organizationId,
      input.domainId
    );

    const email = `${input.localPart.toLowerCase()}@${domain.name}`;
    const existing = await mailboxRepository.findByEmail(email);
    if (existing) throw new ConflictError("This mailbox already exists.");

    const passwordHash = await hashPassword(input.password);
    const displayName =
      input.displayName ??
      (`${input.firstName ?? ""} ${input.lastName ?? ""}`.trim() ||
        input.localPart);

    const maildirPath = await mailProvisionService.provisionMailbox({
      domain: domain.name,
      localPart: input.localPart,
      email,
      passwordHash,
      quotaBytes: input.quotaBytes ? BigInt(input.quotaBytes) : BigInt(5368709120),
    });

    const mailbox = await mailboxRepository.create({
      email,
      localPart: input.localPart.toLowerCase(),
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash,
      displayName,
      status: input.status ?? "ACTIVE",
      quotaBytes: input.quotaBytes ? BigInt(input.quotaBytes) : BigInt(5368709120),
      maildirPath,
      passwordChangedAt: new Date(),
      domain: { connect: { id: domain.id } },
      organization: { connect: { id: organizationId } },
    });

    const shouldCreateUser = input.createUser ?? input.role === "MAIL_USER";

    if (shouldCreateUser) {
      const user = await userRepository.create({
        email,
        passwordHash,
        firstName: input.firstName ?? input.localPart,
        lastName: input.lastName ?? "",
        role: input.role ?? UserRole.MAIL_USER,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        organization: { connect: { id: organizationId } },
      });

      await mailboxRepository.update(mailbox.id, {
        user: { connect: { id: user.id } },
      });
    }

    await auditLogRepository.create({
      action: "CREATE",
      resource: "mailbox",
      resourceId: mailbox.id,
      description: `Created mailbox: ${email}`,
      user: { connect: { id: createdBy.id } },
      organization: { connect: { id: organizationId } },
    });

    return mailbox;
  }

  async getById(id: string) {
    const mailbox = await mailboxRepository.findByIdWithRelations(id);
    if (!mailbox) throw new NotFoundError("Mailbox not found");
    return mailbox;
  }

  async getDetails(id: string) {
    const mailbox = await this.getById(id);

    const [aliases, forwarders, activity] = await Promise.all([
      aliasRepository.findMany({
        where: { mailboxId: id },
        take: 50,
      }),
      forwarderRepository.findMany({
        where: {
          OR: [{ sourceMailboxId: id }, { targetMailboxId: id }],
        },
        take: 50,
      }),
      auditLogRepository.findMany({
        where: { resource: "mailbox", resourceId: id },
        take: 20,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const usagePercent =
      mailbox.quotaBytes > BigInt(0)
        ? Number((mailbox.usedBytes * BigInt(100)) / mailbox.quotaBytes)
        : 0;

    return {
      mailbox,
      aliases: aliases.aliases,
      forwarders: forwarders.forwarders,
      activity: activity.logs,
      usage: {
        usedBytes: mailbox.usedBytes,
        quotaBytes: mailbox.quotaBytes,
        remaining: mailbox.quotaBytes - mailbox.usedBytes,
        usagePercent,
      },
    };
  }

  async list(params: {
    skip: number;
    take: number;
    organizationId?: string;
    domainId?: string;
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    const where = {
      ...(params.organizationId ? { organizationId: params.organizationId } : {}),
      ...(params.domainId ? { domainId: params.domainId } : {}),
      status: params.status
        ? (params.status as "ACTIVE" | "SUSPENDED" | "PENDING" | "DELETED")
        : { not: "DELETED" as const },
      ...(params.search
        ? {
            OR: [
              { email: { contains: params.search, mode: "insensitive" as const } },
              { displayName: { contains: params.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    return mailboxRepository.findMany({
      skip: params.skip,
      take: params.take,
      where,
      orderBy: { [params.sortBy ?? "createdAt"]: params.sortOrder ?? "desc" },
    });
  }

  async update(id: string, input: UpdateMailboxInput, updatedBy: AuthenticatedUser) {
    const mailbox = await mailboxRepository.findById(id);
    if (!mailbox) throw new NotFoundError("Mailbox not found");

    const updated = await mailboxRepository.update(id, {
      firstName: input.firstName,
      lastName: input.lastName,
      displayName: input.displayName,
      quotaBytes: input.quotaBytes ? BigInt(input.quotaBytes) : undefined,
      status: input.status,
    });

    await auditLogRepository.create({
      action: "UPDATE",
      resource: "mailbox",
      resourceId: id,
      user: { connect: { id: updatedBy.id } },
      organization: { connect: { id: mailbox.organizationId } },
    });

    return updated;
  }

  async resetPassword(id: string, newPassword: string, resetBy: AuthenticatedUser) {
    const mailbox = await mailboxRepository.findById(id);
    if (!mailbox) throw new NotFoundError("Mailbox not found");

    const passwordHash = await hashPassword(newPassword);
    await mailboxRepository.update(id, {
      passwordHash,
      passwordChangedAt: new Date(),
    });

    if (mailbox.userId) {
      await userRepository.update(mailbox.userId, { passwordHash });
    }

    if (mailbox.maildirPath) {
      await mailProvisionService.updateMailboxPassword(
        mailbox.email,
        passwordHash,
        mailbox.maildirPath
      );
    }

    await auditLogRepository.create({
      action: "RESET_PASSWORD",
      resource: "mailbox",
      resourceId: id,
      user: { connect: { id: resetBy.id } },
      organization: { connect: { id: mailbox.organizationId } },
    });
  }

  async suspend(id: string, reason: string | undefined, suspendedBy: AuthenticatedUser) {
    const mailbox = await mailboxRepository.findById(id);
    if (!mailbox) throw new NotFoundError("Mailbox not found");

    const suspended = await mailboxRepository.suspend(id, reason);

    await auditLogRepository.create({
      action: "SUSPEND",
      resource: "mailbox",
      resourceId: id,
      user: { connect: { id: suspendedBy.id } },
      organization: { connect: { id: mailbox.organizationId } },
    });

    return suspended;
  }

  async activate(id: string, activatedBy: AuthenticatedUser) {
    const mailbox = await mailboxRepository.findById(id);
    if (!mailbox) throw new NotFoundError("Mailbox not found");

    if (mailbox.status !== "ACTIVE") {
      await planEnforcementService.assertCanCreateMailbox(
        mailbox.organizationId,
        mailbox.domainId
      );
    }

    const activated = await mailboxRepository.activate(id);

    await auditLogRepository.create({
      action: "ACTIVATE",
      resource: "mailbox",
      resourceId: id,
      user: { connect: { id: activatedBy.id } },
      organization: { connect: { id: mailbox.organizationId } },
    });

    return activated;
  }

  async delete(id: string, deletedBy: AuthenticatedUser) {
    const mailbox = await mailboxRepository.findById(id);
    if (!mailbox) throw new NotFoundError("Mailbox not found");

    await mailProvisionService.deprovisionMailbox(
      mailbox.maildirPath,
      mailbox.email
    );

    await mailboxRepository.permanentlyDelete(id);

    await auditLogRepository.create({
      action: "DELETE",
      resource: "mailbox",
      resourceId: id,
      description: `Permanently deleted mailbox: ${mailbox.email}`,
      user: { connect: { id: deletedBy.id } },
      organization: { connect: { id: mailbox.organizationId } },
    });

    return { email: mailbox.email };
  }

  async setVacation(id: string, input: VacationInput, userId: string) {
    const mailbox = await mailboxRepository.findById(id);
    if (!mailbox) throw new NotFoundError("Mailbox not found");

    return mailboxRepository.update(id, {
      vacationEnabled: input.enabled,
      vacationSubject: input.subject,
      vacationMessage: input.message,
      vacationStartDate: input.startDate ? new Date(input.startDate) : null,
      vacationEndDate: input.endDate ? new Date(input.endDate) : null,
    });
  }

  async updateSpamSettings(
    id: string,
    settings: { spamScore?: number; whitelist?: string[]; blacklist?: string[] }
  ) {
    const mailbox = await mailboxRepository.findById(id);
    if (!mailbox) throw new NotFoundError("Mailbox not found");

    return mailboxRepository.update(id, {
      spamScore: settings.spamScore,
      spamWhitelist: settings.whitelist,
      spamBlacklist: settings.blacklist,
    });
  }

  async getStats(organizationId?: string) {
    return mailboxRepository.getStats(organizationId);
  }

  async getRecent(organizationId: string, limit = 5) {
    const { mailboxes } = await mailboxRepository.findMany({
      where: { organizationId, status: { not: "DELETED" } },
      take: limit,
      orderBy: { createdAt: "desc" },
    });
    return mailboxes;
  }
}

export class AliasService {
  async create(organizationId: string, input: CreateAliasInput, createdBy: AuthenticatedUser) {
    await planEnforcementService.assertCanCreateAlias(organizationId);

    const domain = await domainRepository.findById(input.domainId);
    if (!domain || domain.organizationId !== organizationId) {
      throw new NotFoundError("Domain not found");
    }

    const existing = await aliasRepository.findMany({
      where: { address: input.address.toLowerCase() },
      take: 1,
    });
    if (existing.total > 0) throw new ConflictError("Alias already exists");

    const alias = await aliasRepository.create({
      address: input.address.toLowerCase(),
      recipients: input.recipients.map((r) => r.toLowerCase()),
      domain: { connect: { id: domain.id } },
      organization: { connect: { id: organizationId } },
      ...(input.mailboxId ? { mailbox: { connect: { id: input.mailboxId } } } : {}),
    });

    await auditLogRepository.create({
      action: "CREATE",
      resource: "alias",
      resourceId: alias.id,
      user: { connect: { id: createdBy.id } },
      organization: { connect: { id: organizationId } },
    });

    return alias;
  }

  async list(params: {
    skip: number;
    take: number;
    organizationId?: string;
    domainId?: string;
    search?: string;
  }) {
    const where = {
      ...(params.organizationId ? { organizationId: params.organizationId } : {}),
      ...(params.domainId ? { domainId: params.domainId } : {}),
      ...(params.search
        ? { address: { contains: params.search, mode: "insensitive" as const } }
        : {}),
    };

    return aliasRepository.findMany({
      skip: params.skip,
      take: params.take,
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async update(
    id: string,
    input: {
      recipients?: string[];
      isActive?: boolean;
      mailboxId?: string | null;
    },
    updatedBy: AuthenticatedUser
  ) {
    const alias = await aliasRepository.findById(id);
    if (!alias) throw new NotFoundError("Alias not found");

    const updated = await aliasRepository.update(id, {
      ...(input.recipients
        ? { recipients: input.recipients.map((r) => r.toLowerCase()) }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.mailboxId !== undefined
        ? input.mailboxId
          ? { mailbox: { connect: { id: input.mailboxId } } }
          : { mailbox: { disconnect: true } }
        : {}),
    });

    await auditLogRepository.create({
      action: "UPDATE",
      resource: "alias",
      resourceId: id,
      user: { connect: { id: updatedBy.id } },
      organization: { connect: { id: alias.organizationId } },
    });

    return updated;
  }

  async delete(id: string, deletedBy: AuthenticatedUser) {
    const alias = await aliasRepository.findById(id);
    if (!alias) throw new NotFoundError("Alias not found");

    await aliasRepository.delete(id);

    await auditLogRepository.create({
      action: "DELETE",
      resource: "alias",
      resourceId: id,
      user: { connect: { id: deletedBy.id } },
      organization: { connect: { id: alias.organizationId } },
    });
  }
}

export class ForwarderService {
  async create(
    organizationId: string,
    input: CreateForwarderInput,
    createdBy: AuthenticatedUser
  ) {
    await planEnforcementService.assertCanCreateForwarder(organizationId);

    const domain = await domainRepository.findById(input.domainId);
    if (!domain || domain.organizationId !== organizationId) {
      throw new NotFoundError("Domain not found");
    }

    const forwarder = await forwarderRepository.create({
      sourceEmail: input.sourceEmail.toLowerCase(),
      type: input.type,
      keepCopy: input.keepCopy ?? false,
      targetEmail: input.targetEmail?.toLowerCase(),
      domain: { connect: { id: domain.id } },
      organization: { connect: { id: organizationId } },
      ...(input.targetMailboxId
        ? { targetMailbox: { connect: { id: input.targetMailboxId } } }
        : {}),
    });

    await auditLogRepository.create({
      action: "CREATE",
      resource: "forwarder",
      resourceId: forwarder.id,
      user: { connect: { id: createdBy.id } },
      organization: { connect: { id: organizationId } },
    });

    return forwarder;
  }

  async list(params: {
    skip: number;
    take: number;
    organizationId?: string;
    search?: string;
  }) {
    const where = {
      ...(params.organizationId ? { organizationId: params.organizationId } : {}),
      ...(params.search
        ? { sourceEmail: { contains: params.search, mode: "insensitive" as const } }
        : {}),
    };

    return forwarderRepository.findMany({
      skip: params.skip,
      take: params.take,
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async update(
    id: string,
    input: {
      targetEmail?: string;
      targetMailboxId?: string | null;
      keepCopy?: boolean;
      isActive?: boolean;
    },
    updatedBy: AuthenticatedUser
  ) {
    const forwarder = await forwarderRepository.findById(id);
    if (!forwarder) throw new NotFoundError("Forwarder not found");

    const updated = await forwarderRepository.update(id, {
      ...(input.targetEmail !== undefined
        ? { targetEmail: input.targetEmail?.toLowerCase() }
        : {}),
      ...(input.keepCopy !== undefined ? { keepCopy: input.keepCopy } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.targetMailboxId !== undefined
        ? input.targetMailboxId
          ? { targetMailbox: { connect: { id: input.targetMailboxId } } }
          : { targetMailbox: { disconnect: true } }
        : {}),
    });

    await auditLogRepository.create({
      action: "UPDATE",
      resource: "forwarder",
      resourceId: id,
      user: { connect: { id: updatedBy.id } },
      organization: { connect: { id: forwarder.organizationId } },
    });

    return updated;
  }

  async delete(id: string, deletedBy: AuthenticatedUser) {
    const forwarder = await forwarderRepository.findById(id);
    if (!forwarder) throw new NotFoundError("Forwarder not found");

    await forwarderRepository.delete(id);

    await auditLogRepository.create({
      action: "DELETE",
      resource: "forwarder",
      resourceId: id,
      user: { connect: { id: deletedBy.id } },
      organization: { connect: { id: forwarder.organizationId } },
    });
  }
}

export class WebmailService {
  generateSsoToken(email: string, password: string) {
    const token = Buffer.from(
      JSON.stringify({
        email,
        password,
        exp: Date.now() + 60000,
        iss: "mailhost-platform",
      })
    ).toString("base64url");

    return {
      token,
      expiresAt: new Date(Date.now() + 60000),
      roundcubeUrl: `${config.roundcube.url}/?_task=login&_action=plugin.sso&token=${token}`,
    };
  }
}

export const mailboxService = new MailboxService();
export const aliasService = new AliasService();
export const forwarderService = new ForwarderService();
export const webmailService = new WebmailService();
