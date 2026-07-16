"use client";

import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/sidebar";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { openWebmail } from "@/lib/webmail";
import { api } from "@/services/api.client";
import { formatBytes } from "@/utils";
import { HardDrive, Mail, ExternalLink } from "lucide-react";

export default function PortalDashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["portal-dashboard"],
    queryFn: () => api.get("/dashboard"),
  });

  const dashboard = stats?.data as {
    email?: string;
    quota?: string;
    used?: string;
    remaining?: string;
    usagePercent?: number;
    vacationEnabled?: boolean;
    status?: string;
  };

  const openWebmailHandler = () => openWebmail();

  return (
    <DashboardLayout variant="portal" title="Dashboard">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Mailbox"
          value={dashboard?.email ?? "—"}
          icon={Mail}
          loading={isLoading}
        />
        <StatCard
          title="Storage Used"
          value={
            dashboard?.used ? formatBytes(BigInt(dashboard.used)) : "0 B"
          }
          description={
            dashboard?.quota
              ? `of ${formatBytes(BigInt(dashboard.quota))}`
              : undefined
          }
          icon={HardDrive}
          loading={isLoading}
        />
        <StatCard
          title="Usage"
          value={`${dashboard?.usagePercent ?? 0}%`}
          icon={HardDrive}
          loading={isLoading}
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" onClick={openWebmailHandler}>
              <Mail className="mr-2 h-4 w-4" />
              Open Webmail
              <ExternalLink className="ml-auto h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mailbox Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium">{dashboard?.status ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vacation Reply</span>
                <span className="font-medium">
                  {dashboard?.vacationEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
