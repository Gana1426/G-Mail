import { organizationRepository } from "@/repositories/organization.repository";
import { planRepository } from "@/repositories/plan.repository";
import { domainRepository } from "@/repositories/domain.repository";
import { mailboxRepository } from "@/repositories/mailbox.repository";
import { NotFoundError, ForbiddenError, PlanLimitError } from "@/utils/errors";
import {
  PLAN_LIMIT_MESSAGES,
  type PlanUsageSummary,
  type ResourceUsage,
} from "@/types/plan-usage";
import type { Plan } from "@prisma/client";

export { PLAN_LIMIT_MESSAGES } from "@/types/plan-usage";
export type { PlanUsageSummary, ResourceUsage } from "@/types/plan-usage";

export interface PlanUsage {
  plan: Plan;
  domains: { used: number; limit: number };
  mailboxes: { used: number; limit: number };
  storage: { used: bigint; limit: bigint; percent: number };
  aliasesEnabled: boolean;
  forwardersEnabled: boolean;
}

function usageFromCount(used: number, limit: number): ResourceUsage {
  const unlimited = limit === -1;
  const atLimit = !unlimited && used >= limit;
  const remaining = unlimited ? null : Math.max(0, limit - used);
  const percent =
    unlimited || limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));

  return { used, limit, atLimit, remaining, percent };
}

function orgLimitsFromPlan(plan: Plan) {
  return {
    maxDomains: plan.maxDomains,
    maxMailboxes: plan.maxMailboxes,
    maxMailboxesPerDomain: plan.maxMailboxesPerDomain,
  };
}

export class PlanEnforcementService {
  async assertOrganizationActive(organizationId: string): Promise<void> {
    const org = await organizationRepository.findById(organizationId);
    if (!org) throw new NotFoundError("Organization not found");
    if (org.subscriptionStatus !== "ACTIVE") {
      throw new ForbiddenError("Active subscription required. Please choose a plan.");
    }
    if (org.status === "SUSPENDED") {
      throw new ForbiddenError("Organization is suspended");
    }
    if (org.status === "DELETED") {
      throw new ForbiddenError("Organization has been deleted");
    }
  }

  async getPlanForOrganization(organizationId: string): Promise<Plan> {
    const org = await organizationRepository.findByIdWithPlan(organizationId);
    if (!org) throw new NotFoundError("Organization not found");
    if (!org.plan) {
      const freePlan = await planRepository.findDefaultFree();
      if (!freePlan) throw new NotFoundError("No plan assigned");
      return freePlan;
    }
    return org.plan;
  }

  async getUsage(organizationId: string): Promise<PlanUsage> {
    const org = await organizationRepository.findByIdWithPlan(organizationId);
    if (!org) throw new NotFoundError("Organization not found");

    const plan = org.plan ?? (await planRepository.findDefaultFree());
    if (!plan) throw new NotFoundError("No plan assigned");

    const [domainCount, mailboxCount] = await Promise.all([
      domainRepository.countByOrganization(organizationId),
      mailboxRepository.countActiveByOrganization(organizationId),
    ]);

    const storagePercent =
      org.storageQuota > BigInt(0)
        ? Number((org.storageUsed * BigInt(100)) / org.storageQuota)
        : 0;

    return {
      plan,
      domains: {
        used: domainCount,
        limit: plan.maxDomains,
      },
      mailboxes: {
        used: mailboxCount,
        limit: plan.maxMailboxes,
      },
      storage: {
        used: org.storageUsed,
        limit: org.storageQuota,
        percent: storagePercent,
      },
      aliasesEnabled: plan.aliasesEnabled,
      forwardersEnabled: plan.forwardersEnabled,
    };
  }

  async getUsageSummary(organizationId: string): Promise<PlanUsageSummary> {
    const usage = await this.getUsage(organizationId);
    const { plan } = usage;

    const domains = usageFromCount(usage.domains.used, usage.domains.limit);
    const mailboxes = usageFromCount(
      usage.mailboxes.used,
      usage.mailboxes.limit
    );
    const storageAtLimit =
      usage.storage.limit > BigInt(0) &&
      usage.storage.used >= usage.storage.limit;

    return {
      plan: {
        id: plan.id,
        name: plan.name,
        tier: plan.tier,
        code: plan.code,
        maxDomains: plan.maxDomains,
        maxMailboxes: plan.maxMailboxes,
        maxMailboxesPerDomain: plan.maxMailboxesPerDomain,
        storageQuotaBytes: plan.storageQuotaBytes.toString(),
        aliasesEnabled: plan.aliasesEnabled,
        forwardersEnabled: plan.forwardersEnabled,
      },
      domains,
      mailboxes,
      storage: {
        used: usage.storage.used.toString(),
        limit: usage.storage.limit.toString(),
        percent: usage.storage.percent,
        atLimit: storageAtLimit,
      },
      aliasesEnabled: usage.aliasesEnabled,
      forwardersEnabled: usage.forwardersEnabled,
      canCreateDomain: !domains.atLimit,
      canCreateMailbox: !mailboxes.atLimit,
      limitMessages: PLAN_LIMIT_MESSAGES,
    };
  }

  async assertCanCreateDomain(organizationId: string): Promise<void> {
    await this.assertOrganizationActive(organizationId);
    const plan = await this.getPlanForOrganization(organizationId);
    const count = await domainRepository.countByOrganization(organizationId);
    const limit = orgLimitsFromPlan(plan).maxDomains;

    if (limit !== -1 && count >= limit) {
      throw new PlanLimitError(PLAN_LIMIT_MESSAGES.domain);
    }
  }

  async assertCanCreateMailbox(
    organizationId: string,
    domainId?: string
  ): Promise<void> {
    await this.assertOrganizationActive(organizationId);
    const plan = await this.getPlanForOrganization(organizationId);
    const limits = orgLimitsFromPlan(plan);

    const activeMailboxes =
      await mailboxRepository.countActiveByOrganization(organizationId);
    if (
      limits.maxMailboxes !== -1 &&
      activeMailboxes >= limits.maxMailboxes
    ) {
      throw new PlanLimitError(PLAN_LIMIT_MESSAGES.mailbox);
    }

    if (domainId && limits.maxMailboxesPerDomain) {
      const domainCount = await mailboxRepository.countByDomain(domainId);
      if (domainCount >= limits.maxMailboxesPerDomain) {
        throw new PlanLimitError(PLAN_LIMIT_MESSAGES.mailboxPerDomain);
      }
    }
  }

  async assertCanCreateAlias(organizationId: string): Promise<void> {
    await this.assertOrganizationActive(organizationId);
    const plan = await this.getPlanForOrganization(organizationId);
    if (!plan.aliasesEnabled) {
      throw new PlanLimitError(PLAN_LIMIT_MESSAGES.alias);
    }
  }

  async assertCanCreateForwarder(organizationId: string): Promise<void> {
    await this.assertOrganizationActive(organizationId);
    const plan = await this.getPlanForOrganization(organizationId);
    if (!plan.forwardersEnabled) {
      throw new PlanLimitError(PLAN_LIMIT_MESSAGES.forwarder);
    }
  }

  async applyPlanToOrganization(organizationId: string, planId: string) {
    const plan = await planRepository.findById(planId);
    if (!plan) throw new NotFoundError("Plan not found");
    if (plan.status !== "ACTIVE") {
      throw new ForbiddenError("Plan is not active");
    }

    const limits = orgLimitsFromPlan(plan);
    return organizationRepository.update(organizationId, {
      plan: { connect: { id: planId } },
      maxDomains: limits.maxDomains,
      maxMailboxes: limits.maxMailboxes,
      maxMailboxesPerDomain: limits.maxMailboxesPerDomain,
      storageQuota: plan.storageQuotaBytes,
    });
  }
}

export const planEnforcementService = new PlanEnforcementService();
