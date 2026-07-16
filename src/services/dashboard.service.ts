import { organizationRepository } from "@/repositories/organization.repository";
import { domainRepository } from "@/repositories/domain.repository";
import { mailboxRepository } from "@/repositories/mailbox.repository";
import {
  mailQueueRepository,
  spamLogRepository,
} from "@/repositories/mail.repository";
import { auditLogRepository } from "@/repositories/user.repository";
import { planEnforcementService } from "@/services/plan-enforcement.service";
import { mailboxService } from "@/services/mailbox.service";
import type { DashboardStats } from "@/types";
import os from "os";

export class DashboardService {
  async getSuperAdminStats(): Promise<DashboardStats> {
    const [orgStats, domainStats, mailboxStats, queueStats, spamCount] =
      await Promise.all([
        organizationRepository.getStats(),
        domainRepository.getStats(),
        mailboxRepository.getStats(),
        mailQueueRepository.getStats(),
        spamLogRepository.getQuarantineCount(),
      ]);

    const systemMetrics = this.getSystemMetrics();

    return {
      totalOrganizations: orgStats.total,
      totalDomains: domainStats.total,
      totalMailboxes: mailboxStats.total,
      totalStorage: orgStats.totalStorage,
      usedStorage: orgStats.usedStorage,
      mailQueue: queueStats,
      spamQueue: spamCount,
      systemMetrics,
    };
  }

  async getOrgAdminStats(organizationId: string) {
    const [org, domains, mailboxStats, recentMailboxes, recentActivity] =
      await Promise.all([
        organizationRepository.findByIdWithStats(organizationId),
        domainRepository.findByOrganization(organizationId),
        mailboxRepository.getStats(organizationId),
        mailboxService.getRecent(organizationId, 5),
        auditLogRepository.findMany({
          where: { organizationId },
          take: 8,
          orderBy: { createdAt: "desc" },
        }),
      ]);

    if (!org) return null;

    const verifiedDomains = domains.filter((d) => d.status === "VERIFIED");
    const pendingDomains = domains.filter(
      (d) => d.status === "PENDING" || d.status === "VERIFYING" || d.status === "FAILED"
    );

    const planUsage = await planEnforcementService.getUsage(organizationId);

    return {
      organization: org,
      planUsage: {
        ...planUsage,
        storage: {
          ...planUsage.storage,
          used: planUsage.storage.used.toString(),
          limit: planUsage.storage.limit.toString(),
        },
      },
      domains: domains.length,
      verifiedDomains: verifiedDomains.length,
      pendingDomains: pendingDomains.length,
      domainList: domains.map((d) => ({
        id: d.id,
        name: d.name,
        status: d.status,
        isDefault: d.isDefault,
        verifiedAt: d.verifiedAt,
        lastVerifiedAt: d.lastVerifiedAt,
      })),
      mailboxes: {
        ...mailboxStats,
        totalQuota: mailboxStats.totalQuota.toString(),
        totalUsed: mailboxStats.totalUsed.toString(),
      },
      storage: {
        quota: org.storageQuota.toString(),
        used: org.storageUsed.toString(),
        remaining: (org.storageQuota - org.storageUsed).toString(),
      },
      recentMailboxes: recentMailboxes.map((m) => ({
        id: m.id,
        email: m.email,
        displayName: m.displayName,
        status: m.status,
        domain: m.domain?.name,
        createdAt: m.createdAt,
        quotaBytes: m.quotaBytes.toString(),
        usedBytes: m.usedBytes.toString(),
      })),
      recentActivity: recentActivity.logs.map((log) => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        description: log.description,
        createdAt: log.createdAt,
        user: log.user
          ? { firstName: log.user.firstName, lastName: log.user.lastName }
          : null,
      })),
    };
  }

  async getUserStats(userId: string, mailboxId?: string) {
    if (!mailboxId) return null;

    const mailbox = await mailboxRepository.findById(mailboxId);
    if (!mailbox) return null;

    return {
      email: mailbox.email,
      quota: mailbox.quotaBytes,
      used: mailbox.usedBytes,
      remaining: mailbox.quotaBytes - mailbox.usedBytes,
      usagePercent: Number(
        (mailbox.usedBytes * BigInt(100)) / mailbox.quotaBytes
      ),
      vacationEnabled: mailbox.vacationEnabled,
      status: mailbox.status,
    };
  }

  private getSystemMetrics() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const cpus = os.cpus();
    const cpuUsage =
      cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
        const idle = cpu.times.idle;
        return acc + ((total - idle) / total) * 100;
      }, 0) / cpus.length;

    return {
      cpuUsage: Math.round(cpuUsage * 100) / 100,
      memoryUsage: Math.round((usedMem / totalMem) * 10000) / 100,
      diskUsage: 0,
    };
  }

  async getChartData(days = 30) {
    const dates: string[] = [];
    const mailVolume: number[] = [];
    const storageGrowth: number[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split("T")[0]);
      mailVolume.push(Math.floor(Math.random() * 500) + 100);
      storageGrowth.push(Math.floor(Math.random() * 50) + 10);
    }

    return { dates, mailVolume, storageGrowth };
  }
}

export const dashboardService = new DashboardService();
