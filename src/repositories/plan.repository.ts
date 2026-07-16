import { prisma } from "@/lib/prisma";
import type { Plan, Prisma, PlanStatus, PlanTier } from "@prisma/client";

export class PlanRepository {
  async findById(id: string): Promise<Plan | null> {
    return prisma.plan.findUnique({ where: { id } });
  }

  async findByCode(code: string): Promise<Plan | null> {
    return prisma.plan.findUnique({ where: { code } });
  }

  async findDefaultFree(): Promise<Plan | null> {
    return prisma.plan.findFirst({
      where: { tier: "FREE", status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(data: Prisma.PlanCreateInput): Promise<Plan> {
    return prisma.plan.create({ data });
  }

  async update(id: string, data: Prisma.PlanUpdateInput): Promise<Plan> {
    return prisma.plan.update({ where: { id }, data });
  }

  async delete(id: string): Promise<Plan> {
    return prisma.plan.delete({ where: { id } });
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.PlanWhereInput;
    orderBy?: Prisma.PlanOrderByWithRelationInput;
  }) {
    const [plans, total] = await Promise.all([
      prisma.plan.findMany({
        ...params,
        include: {
          _count: { select: { organizations: true } },
        },
      }),
      prisma.plan.count({ where: params.where }),
    ]);
    return { plans, total };
  }

  async activate(id: string): Promise<Plan> {
    return prisma.plan.update({
      where: { id },
      data: { status: "ACTIVE" as PlanStatus },
    });
  }

  async deactivate(id: string): Promise<Plan> {
    return prisma.plan.update({
      where: { id },
      data: { status: "INACTIVE" as PlanStatus },
    });
  }

  async countOrganizations(planId: string): Promise<number> {
    return prisma.organization.count({ where: { planId } });
  }
}

export const planRepository = new PlanRepository();
