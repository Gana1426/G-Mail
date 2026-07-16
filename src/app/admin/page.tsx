"use client";

import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/sidebar";
import { StatCard } from "@/components/dashboard/stat-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { api } from "@/services/api.client";
import { formatBytes } from "@/utils";
import {
  Building2,
  Globe,
  Mail,
  HardDrive,
  ListOrdered,
  Shield,
  Cpu,
  MemoryStick,
} from "lucide-react";

interface DashboardData {
  totalOrganizations: number;
  totalDomains: number;
  totalMailboxes: number;
  totalStorage: string;
  usedStorage: string;
  mailQueue: {
    incoming: number;
    outgoing: number;
    deferred: number;
    failed: number;
  };
  spamQueue: number;
  systemMetrics: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
  };
}

export default function AdminDashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardData>("/dashboard"),
  });

  const { data: charts } = useQuery({
    queryKey: ["dashboard-charts"],
    queryFn: () =>
      api.get<{
        dates: string[];
        mailVolume: number[];
        storageGrowth: number[];
      }>("/dashboard?type=charts"),
  });

  const dashboard = stats?.data;
  const chartData = charts?.data;

  const mailChartData =
    chartData?.dates.map((date, i) => ({
      name: date.slice(5),
      value: chartData.mailVolume[i],
    })) ?? [];

  const storageChartData =
    chartData?.dates.map((date, i) => ({
      name: date.slice(5),
      value: chartData.storageGrowth[i],
    })) ?? [];

  return (
    <DashboardLayout variant="admin" title="Dashboard">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Organizations"
          value={dashboard?.totalOrganizations ?? 0}
          icon={Building2}
          loading={isLoading}
        />
        <StatCard
          title="Domains"
          value={dashboard?.totalDomains ?? 0}
          icon={Globe}
          loading={isLoading}
        />
        <StatCard
          title="Mailboxes"
          value={dashboard?.totalMailboxes ?? 0}
          icon={Mail}
          loading={isLoading}
        />
        <StatCard
          title="Storage Used"
          value={
            dashboard
              ? formatBytes(BigInt(dashboard.usedStorage))
              : "0 B"
          }
          description={
            dashboard
              ? `of ${formatBytes(BigInt(dashboard.totalStorage))}`
              : undefined
          }
          icon={HardDrive}
          loading={isLoading}
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Mail Queue"
          value={
            dashboard
              ? dashboard.mailQueue.incoming + dashboard.mailQueue.outgoing
              : 0
          }
          description="Incoming + Outgoing"
          icon={ListOrdered}
          loading={isLoading}
        />
        <StatCard
          title="Spam Quarantine"
          value={dashboard?.spamQueue ?? 0}
          icon={Shield}
          loading={isLoading}
        />
        <StatCard
          title="CPU Usage"
          value={`${dashboard?.systemMetrics.cpuUsage ?? 0}%`}
          icon={Cpu}
          loading={isLoading}
        />
        <StatCard
          title="Memory Usage"
          value={`${dashboard?.systemMetrics.memoryUsage ?? 0}%`}
          icon={MemoryStick}
          loading={isLoading}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Mail Volume" data={mailChartData} type="area" />
        <ChartCard title="Storage Growth" data={storageChartData} type="bar" />
      </div>
    </DashboardLayout>
  );
}
