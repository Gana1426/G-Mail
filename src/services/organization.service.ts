import { prisma } from "@/lib/prisma";
import { organizationRepository } from "@/repositories/organization.repository";
import { planRepository } from "@/repositories/plan.repository";
import { userRepository, auditLogRepository } from "@/repositories/user.repository";
import { mailboxRepository } from "@/repositories/mailbox.repository";
import { mailProvisionService } from "@/services/mail-provision.service";
import { planEnforcementService } from "@/services/plan-enforcement.service";
import { planService } from "@/services/plan.service";
import { slugify } from "@/utils";
import { hashPassword, generateTemporaryPassword } from "@/utils/crypto";
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from "@/utils/errors";
import type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
} from "@/utils/validation";
import { OrganizationStatus, UserRole, UserStatus } from "@prisma/client";
import type { AuthenticatedUser } from "@/types";

export class OrganizationService {
  async create(input: CreateOrganizationInput, createdBy: AuthenticatedUser) {
    const slug = input.slug ?? slugify(input.name);

    const existing = await organizationRepository.findBySlug(slug);
    if (existing) {
      throw new ConflictError("Organization slug already exists");
    }

    let planId = input.planId;
    if (!planId) {
      const freePlan = await planRepository.findDefaultFree();
      planId = freePlan?.id;
    }

    const plan = planId ? await planRepository.findById(planId) : null;
    if (!plan) throw new NotFoundError("Plan not found");

    const organization = await organizationRepository.create({
      name: input.name,
      slug,
      description: input.description,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      address: input.address,
      status: OrganizationStatus.ACTIVE,
      subscriptionStatus: "ACTIVE",
      planActivatedAt: new Date(),
      maxDomains: plan.maxDomains,
      maxMailboxes: plan.maxMailboxes,
      maxMailboxesPerDomain: plan.maxMailboxesPerDomain,
      storageQuota: plan.storageQuotaBytes,
      ...(planId ? { plan: { connect: { id: planId } } } : {}),
    });

    if (input.ownerEmail && input.ownerPassword && input.ownerFirstName && input.ownerLastName) {
      const ownerExists = await userRepository.findByEmail(input.ownerEmail);
      if (ownerExists) throw new ConflictError("Owner email already exists");

      const owner = await userRepository.create({
        email: input.ownerEmail.toLowerCase(),
        passwordHash: await hashPassword(input.ownerPassword),
        firstName: input.ownerFirstName,
        lastName: input.ownerLastName,
        role: UserRole.ORG_ADMIN,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        organization: { connect: { id: organization.id } },
      });

      await organizationRepository.update(organization.id, {
        owner: { connect: { id: owner.id } },
        contactEmail: input.ownerEmail,
      });
    }

    await auditLogRepository.create({
      action: "CREATE",
      resource: "organization",
      resourceId: organization.id,
      description: `Created organization: ${organization.name}`,
      user: { connect: { id: createdBy.id } },
      organization: { connect: { id: organization.id } },
    });

    return organizationRepository.findByIdWithStats(organization.id);
  }

  async getById(id: string) {
    const org = await organizationRepository.findByIdWithStats(id);
    if (!org) throw new NotFoundError("Organization not found");
    return org;
  }

  async getDetails(id: string) {
    const org = await organizationRepository.findByIdWithDetails(id);
    if (!org) throw new NotFoundError("Organization not found");

    const [activity, planUsage] = await Promise.all([
      auditLogRepository.findMany({
        where: { organizationId: id },
        take: 20,
        orderBy: { createdAt: "desc" },
      }),
      planEnforcementService.getUsage(id),
    ]);

    return {
      organization: org,
      activity: activity.logs,
      planUsage,
    };
  }

  async list(params: {
    skip: number;
    take: number;
    search?: string;
    status?: OrganizationStatus;
    planId?: string;
    createdFrom?: Date;
    createdTo?: Date;
    minDomainCount?: number;
    maxDomainCount?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    let domainFilteredIds: string[] | undefined;

    if (
      params.minDomainCount !== undefined ||
      params.maxDomainCount !== undefined
    ) {
      domainFilteredIds = await this.getOrganizationIdsByDomainCount(
        params.minDomainCount,
        params.maxDomainCount
      );
      if (domainFilteredIds.length === 0) {
        return { organizations: [], total: 0 };
      }
    }

    const where = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.planId ? { planId: params.planId } : {}),
      ...(domainFilteredIds ? { id: { in: domainFilteredIds } } : {}),
      ...(params.createdFrom || params.createdTo
        ? {
            createdAt: {
              ...(params.createdFrom ? { gte: params.createdFrom } : {}),
              ...(params.createdTo ? { lte: params.createdTo } : {}),
            },
          }
        : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" as const } },
              { slug: { contains: params.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    return organizationRepository.findMany({
      skip: params.skip,
      take: params.take,
      where,
      orderBy: { [params.sortBy ?? "createdAt"]: params.sortOrder ?? "desc" },
    });
  }

  private async getOrganizationIdsByDomainCount(
    minCount?: number,
    maxCount?: number
  ): Promise<string[]> {
    const allOrgs = await prisma.organization.findMany({
      select: {
        id: true,
        _count: { select: { domains: true } },
      },
    });

    return allOrgs
      .filter((org) => {
        const count = org._count.domains;
        if (minCount !== undefined && count < minCount) return false;
        if (maxCount !== undefined && count > maxCount) return false;
        return true;
      })
      .map((org) => org.id);
  }

  async update(
    id: string,
    input: UpdateOrganizationInput,
    updatedBy: AuthenticatedUser
  ) {
    const org = await organizationRepository.findById(id);
    if (!org) throw new NotFoundError("Organization not found");

    if (
      updatedBy.role !== "SUPER_ADMIN" &&
      updatedBy.organizationId !== id
    ) {
      throw new ForbiddenError("Cannot update this organization");
    }

    if (input.slug && input.slug !== org.slug) {
      const existing = await organizationRepository.findBySlug(input.slug);
      if (existing) throw new ConflictError("Slug already exists");
    }

    const updated = await organizationRepository.update(id, {
      name: input.name,
      slug: input.slug,
      description: input.description ?? undefined,
      contactEmail:
        input.contactEmail === "" || input.contactEmail === null
          ? null
          : input.contactEmail,
      contactPhone: input.contactPhone ?? undefined,
      address: input.address ?? undefined,
      storageQuota: input.storageQuota
        ? BigInt(input.storageQuota)
        : undefined,
      maxDomains: input.maxDomains,
      maxMailboxes: input.maxMailboxes,
    });

    await auditLogRepository.create({
      action: "UPDATE",
      resource: "organization",
      resourceId: id,
      user: { connect: { id: updatedBy.id } },
      organization: { connect: { id } },
    });

    return updated;
  }

  async suspend(id: string, reason: string | undefined, suspendedBy: AuthenticatedUser) {
    const org = await organizationRepository.findById(id);
    if (!org) throw new NotFoundError("Organization not found");

    const suspended = await organizationRepository.suspend(id, reason);

    await prisma.user.updateMany({
      where: { organizationId: id, role: { not: "SUPER_ADMIN" } },
      data: { status: UserStatus.SUSPENDED },
    });

    await auditLogRepository.create({
      action: "SUSPEND",
      resource: "organization",
      resourceId: id,
      description: reason,
      user: { connect: { id: suspendedBy.id } },
      organization: { connect: { id } },
    });

    return suspended;
  }

  async activate(id: string, activatedBy: AuthenticatedUser) {
    const org = await organizationRepository.findById(id);
    if (!org) throw new NotFoundError("Organization not found");

    const activated = await organizationRepository.activate(id);

    await prisma.user.updateMany({
      where: {
        organizationId: id,
        status: UserStatus.SUSPENDED,
        role: { not: "SUPER_ADMIN" },
      },
      data: { status: UserStatus.ACTIVE },
    });

    await auditLogRepository.create({
      action: "ACTIVATE",
      resource: "organization",
      resourceId: id,
      user: { connect: { id: activatedBy.id } },
      organization: { connect: { id } },
    });

    return activated;
  }

  async delete(id: string, deletedBy: AuthenticatedUser) {
    const org = await organizationRepository.findById(id);
    if (!org) throw new NotFoundError("Organization not found");

    const deleted = await organizationRepository.delete(id);

    await auditLogRepository.create({
      action: "DELETE",
      resource: "organization",
      resourceId: id,
      user: { connect: { id: deletedBy.id } },
    });

    return deleted;
  }

  async permanentlyDelete(id: string, deletedBy: AuthenticatedUser) {
    const org = await organizationRepository.findById(id);
    if (!org) throw new NotFoundError("Organization not found");

    const mailboxes = await mailboxRepository.findMany({
      where: { organizationId: id },
      take: 10000,
    });

    for (const mailbox of mailboxes.mailboxes) {
      await mailProvisionService.deprovisionMailbox(
        mailbox.maildirPath,
        mailbox.email
      );
    }

    await organizationRepository.permanentlyDelete(id);

    await auditLogRepository.create({
      action: "DELETE",
      resource: "organization",
      resourceId: id,
      description: `Permanently deleted organization: ${org.name}`,
      user: { connect: { id: deletedBy.id } },
    });
  }

  async resetOwnerPassword(
    id: string,
    options: { password?: string; generate?: boolean },
    resetBy: AuthenticatedUser
  ) {
    const org = await organizationRepository.findByIdWithDetails(id);
    if (!org) throw new NotFoundError("Organization not found");

    const owner =
      org.owner ??
      (await prisma.user.findFirst({
        where: { organizationId: id, role: UserRole.ORG_ADMIN },
      }));

    if (!owner) throw new NotFoundError("Organization owner not found");

    const newPassword =
      options.generate || !options.password
        ? generateTemporaryPassword()
        : options.password;

    const passwordHash = await hashPassword(newPassword);
    await userRepository.update(owner.id, { passwordHash });

    await auditLogRepository.create({
      action: "RESET_PASSWORD",
      resource: "user",
      resourceId: owner.id,
      description: `Reset owner password for ${org.name}`,
      user: { connect: { id: resetBy.id } },
      organization: { connect: { id } },
    });

    return {
      ownerId: owner.id,
      email: owner.email,
      generatedPassword: options.generate || !options.password ? newPassword : undefined,
    };
  }

  async changePlan(
    id: string,
    planId: string,
    changedBy: AuthenticatedUser
  ) {
    const org = await organizationRepository.findById(id);
    if (!org) throw new NotFoundError("Organization not found");

    const updated = await planService.assignToOrganization(id, planId);

    await organizationRepository.update(id, {
      subscriptionStatus: "ACTIVE",
      planActivatedAt: new Date(),
      status: OrganizationStatus.ACTIVE,
    });

    await auditLogRepository.create({
      action: "UPDATE",
      resource: "organization",
      resourceId: id,
      description: `Changed plan to ${planId}`,
      user: { connect: { id: changedBy.id } },
      organization: { connect: { id } },
    });

    return updated;
  }

  async getStats() {
    return organizationRepository.getStats();
  }
}

export const organizationService = new OrganizationService();
