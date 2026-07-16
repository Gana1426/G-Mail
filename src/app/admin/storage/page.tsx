"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/sidebar";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/services/api.client";
import { formatBytes } from "@/utils";
import { HardDrive, Mail, Database } from "lucide-react";
import {
  OrganizationFilter,
  useOrganizationFilterParam,
} from "@/components/admin/organization-filter";

export default function StoragePage() {
  const [orgFilter, setOrgFilter] = useState("all");
  const orgParam =
    orgFilter !== "all" ? `?organizationId=${orgFilter}` : "";

  const { data, isLoading } = useQuery({
    queryKey: ["storage", orgFilter],
    queryFn: () =>
      api.get<{
        total: number;
        active: number;
        totalQuota: string;
        totalUsed: string;
      }>(`/quota${orgParam}`),
  });

  const stats = data?.data;
  const usagePercent =
    stats?.totalQuota && BigInt(stats.totalQuota) > BigInt(0)
      ? Number(
          (BigInt(stats.totalUsed) * BigInt(100)) / BigInt(stats.totalQuota)
        )
      : 0;

  return (
    <DashboardLayout variant="admin" title="Storage">
      <div className="mb-6">
        <OrganizationFilter value={orgFilter} onChange={setOrgFilter} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total Mailboxes"
          value={stats?.total ?? 0}
          description={`${stats?.active ?? 0} active`}
          icon={Mail}
          loading={isLoading}
        />
        <StatCard
          title="Total Quota"
          value={
            stats?.totalQuota
              ? formatBytes(BigInt(stats.totalQuota))
              : "0 B"
          }
          icon={Database}
          loading={isLoading}
        />
        <StatCard
          title="Total Used"
          value={
            stats?.totalUsed
              ? formatBytes(BigInt(stats.totalUsed))
              : "0 B"
          }
          icon={HardDrive}
          loading={isLoading}
        />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Storage Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Usage</span>
            <span>{usagePercent}%</span>
          </div>
          <div className="h-3 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Mail is stored in Maildir on the server. Database tracks quota and usage only.
          </p>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
