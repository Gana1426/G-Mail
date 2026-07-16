import { organizationRepository } from "@/repositories/organization.repository";
import { planRepository } from "@/repositories/plan.repository";
import { billingRepository } from "@/repositories/billing.repository";
import { auditLogRepository } from "@/repositories/user.repository";
import { planEnforcementService } from "@/services/plan-enforcement.service";
import {
  createRazorpayOrder,
  getRazorpayKeyId,
  isRazorpayConfigured,
  toSmallestUnit,
  verifyPaymentSignature,
} from "@/lib/razorpay";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/utils/errors";
import type { AuthenticatedUser } from "@/types";
import type { BillingInterval } from "@prisma/client";
import { OrganizationStatus } from "@prisma/client";

export interface BillingStatus {
  subscriptionStatus: string;
  needsPlanSelection: boolean;
  needsPayment: boolean;
  canAccessDashboard: boolean;
  currentPlan: {
    id: string;
    name: string;
    tier: string;
    code: string;
  } | null;
  pendingPayment: {
    id: string;
    planId: string;
    planName: string;
    amount: number;
    currency: string;
    interval: string;
    razorpayOrderId: string | null;
  } | null;
  planActivatedAt: string | null;
}

export class BillingService {
  async getStatus(organizationId: string): Promise<BillingStatus> {
    const org = await organizationRepository.findByIdWithPlan(organizationId);
    if (!org) throw new NotFoundError("Organization not found");

    const pendingPayment =
      await billingRepository.findPendingPayment(organizationId);

    const needsPlanSelection =
      org.subscriptionStatus === "NONE" ||
      (org.subscriptionStatus === "PENDING_PAYMENT" && !pendingPayment);

    const needsPayment = org.subscriptionStatus === "PENDING_PAYMENT";
    const canAccessDashboard = org.subscriptionStatus === "ACTIVE";

    return {
      subscriptionStatus: org.subscriptionStatus,
      needsPlanSelection,
      needsPayment,
      canAccessDashboard,
      currentPlan: org.plan
        ? {
            id: org.plan.id,
            name: org.plan.name,
            tier: org.plan.tier,
            code: org.plan.code,
          }
        : null,
      pendingPayment: pendingPayment
        ? {
            id: pendingPayment.id,
            planId: pendingPayment.planId,
            planName: pendingPayment.plan.name,
            amount: pendingPayment.amount,
            currency: pendingPayment.currency,
            interval: pendingPayment.interval,
            razorpayOrderId: pendingPayment.razorpayOrderId,
          }
        : null,
      planActivatedAt: org.planActivatedAt?.toISOString() ?? null,
    };
  }

  async listPlans() {
    const { plans } = await planRepository.findMany({
      where: { status: "ACTIVE" },
      orderBy: { monthlyPrice: "asc" },
      take: 50,
    });
    return plans;
  }

  isFreePlan(plan: { monthlyPrice: number; yearlyPrice: number; tier: string }) {
    return plan.tier === "FREE" || (plan.monthlyPrice === 0 && plan.yearlyPrice === 0);
  }

  getPlanPrice(plan: { monthlyPrice: number; yearlyPrice: number }, interval: BillingInterval) {
    return interval === "YEARLY" ? plan.yearlyPrice : plan.monthlyPrice;
  }

  async activateFreePlan(
    organizationId: string,
    planId: string,
    user: AuthenticatedUser
  ) {
    const plan = await planRepository.findById(planId);
    if (!plan) throw new NotFoundError("Plan not found");
    if (plan.status !== "ACTIVE") throw new ForbiddenError("Plan is not available");
    if (!this.isFreePlan(plan)) {
      throw new ValidationError("This plan requires payment");
    }

    await planEnforcementService.applyPlanToOrganization(organizationId, planId);

    await organizationRepository.update(organizationId, {
      subscriptionStatus: "ACTIVE",
      planActivatedAt: new Date(),
      status: OrganizationStatus.ACTIVE,
    });

    await auditLogRepository.create({
      action: "UPDATE",
      resource: "organization",
      resourceId: organizationId,
      description: `Activated free plan: ${plan.name}`,
      user: { connect: { id: user.id } },
    });

    return this.getStatus(organizationId);
  }

  async createPaymentOrder(
    organizationId: string,
    planId: string,
    interval: BillingInterval,
    user: AuthenticatedUser,
    options?: { isUpgrade?: boolean }
  ) {
    if (!isRazorpayConfigured()) {
      throw new ValidationError(
        "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
      );
    }

    const org = await organizationRepository.findById(organizationId);
    if (!org) throw new NotFoundError("Organization not found");
    if (org.subscriptionStatus === "ACTIVE" && !options?.isUpgrade) {
      throw new ForbiddenError("Organization already has an active subscription");
    }

    const plan = await planRepository.findById(planId);
    if (!plan) throw new NotFoundError("Plan not found");
    if (plan.status !== "ACTIVE") throw new ForbiddenError("Plan is not available");
    if (this.isFreePlan(plan)) {
      throw new ValidationError("Use free plan activation for this plan");
    }

    const amount = this.getPlanPrice(plan, interval);
    if (amount <= 0) {
      throw new ValidationError("Invalid plan price");
    }

    const currency = plan.currency ?? "INR";
    const receipt = `org_${organizationId.slice(-8)}_${Date.now()}`;

    const order = await createRazorpayOrder({
      amount: toSmallestUnit(amount),
      currency,
      receipt,
      notes: {
        organizationId,
        planId,
        interval,
        userId: user.id,
      },
    });

    const payment = await billingRepository.createPayment({
      amount,
      currency,
      interval,
      status: "CREATED",
      razorpayOrderId: order.id,
      organization: { connect: { id: organizationId } },
      plan: { connect: { id: planId } },
      metadata: { receipt, createdBy: user.id },
    });

    await organizationRepository.update(organizationId, {
      ...(options?.isUpgrade
        ? {}
        : {
            subscriptionStatus: "PENDING_PAYMENT",
            plan: { connect: { id: planId } },
          }),
    });

    return {
      paymentId: payment.id,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: getRazorpayKeyId(),
      plan: {
        id: plan.id,
        name: plan.name,
        tier: plan.tier,
      },
      interval,
      prefill: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      },
    };
  }

  async verifyPayment(
    organizationId: string,
    params: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
    user: AuthenticatedUser
  ) {
    const payment = await billingRepository.findPaymentByOrderId(
      params.razorpayOrderId
    );
    if (!payment) throw new NotFoundError("Payment not found");
    if (payment.organizationId !== organizationId) {
      throw new ForbiddenError("Payment does not belong to this organization");
    }
    if (payment.status === "CAPTURED") {
      return this.getStatus(organizationId);
    }

    const valid = verifyPaymentSignature(
      params.razorpayOrderId,
      params.razorpayPaymentId,
      params.razorpaySignature
    );
    if (!valid) throw new ValidationError("Invalid payment signature");

    await billingRepository.markCaptured(
      payment.id,
      params.razorpayPaymentId,
      params.razorpaySignature
    );

    await planEnforcementService.applyPlanToOrganization(
      organizationId,
      payment.planId
    );

    await organizationRepository.update(organizationId, {
      subscriptionStatus: "ACTIVE",
      planActivatedAt: new Date(),
      status: OrganizationStatus.ACTIVE,
    });

    await auditLogRepository.create({
      action: "UPDATE",
      resource: "organization",
      resourceId: organizationId,
      description: `Payment captured for plan: ${payment.plan.name}`,
      user: { connect: { id: user.id } },
    });

    return this.getStatus(organizationId);
  }

  async getSubscriptionDetails(organizationId: string) {
    const org = await organizationRepository.findByIdWithPlan(organizationId);
    if (!org) throw new NotFoundError("Organization not found");

    const [status, usage, plans, lastPayment] = await Promise.all([
      this.getStatus(organizationId),
      planEnforcementService.getUsage(organizationId),
      this.listPlans(),
      billingRepository.findLastCapturedPayment(organizationId),
    ]);

    const billingCycle = lastPayment?.interval ?? "MONTHLY";
    const rawStart = org.planActivatedAt ?? org.createdAt;
    const startDate = rawStart ? new Date(rawStart) : new Date();
    const expiryDate = new Date(startDate);
    if (billingCycle === "YEARLY") {
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    } else {
      expiryDate.setMonth(expiryDate.getMonth() + 1);
    }

    const sortedPlans = [...plans].sort(
      (a, b) => b.monthlyPrice - a.monthlyPrice
    );
    const highestPlan = sortedPlans[0];
    const currentPlan = org.plan;
    const isHighestPlan =
      !!currentPlan &&
      (!highestPlan ||
        currentPlan.id === highestPlan.id ||
        currentPlan.monthlyPrice >= highestPlan.monthlyPrice);

    return {
      ...status,
      billingCycle,
      startDate: startDate.toISOString(),
      expiryDate: expiryDate.toISOString(),
      isHighestPlan,
      usage: {
        domains: usage.domains ?? { used: 0, limit: 0 },
        mailboxes: usage.mailboxes ?? { used: 0, limit: 0 },
        storage: {
          used: (usage.storage?.used ?? BigInt(0)).toString(),
          limit: (usage.storage?.limit ?? BigInt(0)).toString(),
          percent: usage.storage?.percent ?? 0,
        },
        aliasesEnabled: usage.aliasesEnabled ?? false,
        forwardersEnabled: usage.forwardersEnabled ?? false,
      },
      plans: plans.map((p) => ({
        ...p,
        storageQuotaBytes: p.storageQuotaBytes.toString(),
        isFree: this.isFreePlan(p),
        isCurrent: p.id === currentPlan?.id,
      })),
    };
  }

  async createUpgradeOrder(
    organizationId: string,
    planId: string,
    interval: BillingInterval,
    user: AuthenticatedUser
  ) {
    const org = await organizationRepository.findByIdWithPlan(organizationId);
    if (!org) throw new NotFoundError("Organization not found");
    if (org.subscriptionStatus !== "ACTIVE") {
      throw new ForbiddenError("Complete initial plan selection first");
    }

    const plan = await planRepository.findById(planId);
    if (!plan) throw new NotFoundError("Plan not found");
    if (plan.id === org.planId) {
      throw new ValidationError("You are already on this plan");
    }

    if (this.isFreePlan(plan)) {
      await planEnforcementService.applyPlanToOrganization(organizationId, planId);
      await organizationRepository.update(organizationId, {
        planActivatedAt: new Date(),
      });
      await auditLogRepository.create({
        action: "UPDATE",
        resource: "organization",
        resourceId: organizationId,
        description: `Changed plan to ${plan.name}`,
        user: { connect: { id: user.id } },
      });
      return { upgraded: true, free: true };
    }

    return this.createPaymentOrder(organizationId, planId, interval, user, {
      isUpgrade: true,
    });
  }

  async handleWebhookPaymentCaptured(
    razorpayOrderId: string,
    razorpayPaymentId: string
  ) {
    const payment = await billingRepository.findPaymentByOrderId(razorpayOrderId);
    if (!payment || payment.status === "CAPTURED") return;

    await billingRepository.markCaptured(
      payment.id,
      razorpayPaymentId,
      "webhook"
    );

    await planEnforcementService.applyPlanToOrganization(
      payment.organizationId,
      payment.planId
    );

    await organizationRepository.update(payment.organizationId, {
      subscriptionStatus: "ACTIVE",
      planActivatedAt: new Date(),
      status: OrganizationStatus.ACTIVE,
    });
  }
}

export const billingService = new BillingService();
