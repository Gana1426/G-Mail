import { planRepository } from "@/repositories/plan.repository";
import { auditLogRepository } from "@/repositories/user.repository";
import { planEnforcementService } from "@/services/plan-enforcement.service";
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from "@/utils/errors";
import type { CreatePlanInput, UpdatePlanInput } from "@/utils/validation";
import type { AuthenticatedUser } from "@/types";
import type { PlanTier } from "@prisma/client";

export class PlanService {
  async create(input: CreatePlanInput, createdBy: AuthenticatedUser) {
    const existing = await planRepository.findByCode(input.code);
    if (existing) throw new ConflictError("Plan code already exists");

    const plan = await planRepository.create({
      code: input.code,
      name: input.name,
      tier: input.tier as PlanTier,
      description: input.description,
      maxDomains: input.maxDomains,
      maxMailboxes: input.maxMailboxes,
      maxMailboxesPerDomain: input.maxMailboxesPerDomain,
      storageQuotaBytes: BigInt(input.storageQuotaBytes),
      aliasesEnabled: input.aliasesEnabled ?? false,
      forwardersEnabled: input.forwardersEnabled ?? false,
      spamProtection: input.spamProtection ?? true,
      prioritySupport: input.prioritySupport ?? false,
      monthlyPrice: input.monthlyPrice ?? 0,
      yearlyPrice: input.yearlyPrice ?? 0,
      businessOption: input.businessOption,
    });

    await auditLogRepository.create({
      action: "CREATE",
      resource: "plan",
      resourceId: plan.id,
      description: `Created plan: ${plan.name}`,
      user: { connect: { id: createdBy.id } },
    });

    return plan;
  }

  async getById(id: string) {
    const plan = await planRepository.findById(id);
    if (!plan) throw new NotFoundError("Plan not found");
    return plan;
  }

  async list(params: {
    skip: number;
    take: number;
    search?: string;
    status?: string;
    tier?: string;
  }) {
    const where = {
      ...(params.status ? { status: params.status as "ACTIVE" | "INACTIVE" } : {}),
      ...(params.tier ? { tier: params.tier as PlanTier } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" as const } },
              { code: { contains: params.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    return planRepository.findMany({
      skip: params.skip,
      take: params.take,
      where,
      orderBy: { monthlyPrice: "asc" },
    });
  }

  async update(id: string, input: UpdatePlanInput, updatedBy: AuthenticatedUser) {
    const plan = await planRepository.findById(id);
    if (!plan) throw new NotFoundError("Plan not found");

    if (input.code && input.code !== plan.code) {
      const existing = await planRepository.findByCode(input.code);
      if (existing) throw new ConflictError("Plan code already exists");
    }

    const updated = await planRepository.update(id, {
      ...input,
      storageQuotaBytes: input.storageQuotaBytes
        ? BigInt(input.storageQuotaBytes)
        : undefined,
    });

    await auditLogRepository.create({
      action: "UPDATE",
      resource: "plan",
      resourceId: id,
      user: { connect: { id: updatedBy.id } },
    });

    return updated;
  }

  async delete(id: string, deletedBy: AuthenticatedUser) {
    const plan = await planRepository.findById(id);
    if (!plan) throw new NotFoundError("Plan not found");

    const orgCount = await planRepository.countOrganizations(id);
    if (orgCount > 0) {
      throw new ForbiddenError(
        `Cannot delete plan with ${orgCount} organization(s) assigned`
      );
    }

    await planRepository.delete(id);

    await auditLogRepository.create({
      action: "DELETE",
      resource: "plan",
      resourceId: id,
      user: { connect: { id: deletedBy.id } },
    });
  }

  async activate(id: string, user: AuthenticatedUser) {
    const plan = await planRepository.activate(id);
    await auditLogRepository.create({
      action: "ACTIVATE",
      resource: "plan",
      resourceId: id,
      user: { connect: { id: user.id } },
    });
    return plan;
  }

  async deactivate(id: string, user: AuthenticatedUser) {
    const plan = await planRepository.deactivate(id);
    await auditLogRepository.create({
      action: "SUSPEND",
      resource: "plan",
      resourceId: id,
      user: { connect: { id: user.id } },
    });
    return plan;
  }

  async clone(id: string, newCode: string, user: AuthenticatedUser) {
    const plan = await planRepository.findById(id);
    if (!plan) throw new NotFoundError("Plan not found");

    const existing = await planRepository.findByCode(newCode);
    if (existing) throw new ConflictError("Plan code already exists");

    const cloned = await planRepository.create({
      code: newCode,
      name: `${plan.name} (Copy)`,
      tier: plan.tier,
      description: plan.description,
      maxDomains: plan.maxDomains,
      maxMailboxes: plan.maxMailboxes,
      maxMailboxesPerDomain: plan.maxMailboxesPerDomain,
      storageQuotaBytes: plan.storageQuotaBytes,
      aliasesEnabled: plan.aliasesEnabled,
      forwardersEnabled: plan.forwardersEnabled,
      spamProtection: plan.spamProtection,
      prioritySupport: plan.prioritySupport,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      businessOption: plan.businessOption,
    });

    await auditLogRepository.create({
      action: "CREATE",
      resource: "plan",
      resourceId: cloned.id,
      description: `Cloned from plan ${plan.name}`,
      user: { connect: { id: user.id } },
    });

    return cloned;
  }

  async assignToOrganization(organizationId: string, planId: string) {
    return planEnforcementService.applyPlanToOrganization(organizationId, planId);
  }
}

export const planService = new PlanService();
