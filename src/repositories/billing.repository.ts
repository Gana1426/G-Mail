import { prisma } from "@/lib/prisma";
import type { Prisma, Payment, PaymentStatus } from "@prisma/client";

export class BillingRepository {
  async findPaymentByOrderId(razorpayOrderId: string) {
    return prisma.payment.findUnique({
      where: { razorpayOrderId },
      include: { plan: true, organization: true },
    });
  }

  async findPaymentById(id: string) {
    return prisma.payment.findUnique({
      where: { id },
      include: { plan: true, organization: true },
    });
  }

  async findPendingPayment(organizationId: string) {
    return prisma.payment.findFirst({
      where: {
        organizationId,
        status: { in: ["CREATED", "AUTHORIZED"] },
      },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    });
  }

  async createPayment(data: Prisma.PaymentCreateInput): Promise<Payment> {
    return prisma.payment.create({ data });
  }

  async updatePayment(id: string, data: Prisma.PaymentUpdateInput) {
    return prisma.payment.update({ where: { id }, data });
  }

  async updatePaymentByOrderId(
    razorpayOrderId: string,
    data: Prisma.PaymentUpdateInput
  ) {
    return prisma.payment.update({
      where: { razorpayOrderId },
      data,
    });
  }

  async listByOrganization(organizationId: string, take = 20) {
    return prisma.payment.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        plan: { select: { id: true, name: true, code: true, tier: true } },
      },
    });
  }

  async findLastCapturedPayment(organizationId: string) {
    return prisma.payment.findFirst({
      where: { organizationId, status: "CAPTURED" },
      orderBy: { paidAt: "desc" },
      include: { plan: true },
    });
  }

  async markCaptured(
    paymentId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ) {
    return prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "CAPTURED" as PaymentStatus,
        razorpayPaymentId,
        razorpaySignature,
        paidAt: new Date(),
      },
    });
  }
}

export const billingRepository = new BillingRepository();
