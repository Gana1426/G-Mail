"use client";

import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/sidebar";
import { api } from "@/services/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes } from "@/utils";
import { HardDrive } from "lucide-react";

interface StorageStats {
  email?: string;
  quota?: string;
  used?: string;
  remaining?: string;
  usagePercent?: number;
}

export default function PortalStoragePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["portal-dashboard"],
    queryFn: () => api.get<StorageStats>("/dashboard"),
  });

  const stats = data?.data;
  const usagePercent = stats?.usagePercent ?? 0;

  return (
    <DashboardLayout variant="portal" title="Storage">
      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="mx-auto max-w-2xl space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <HardDrive className="h-5 w-5 text-primary" />
              <CardTitle>Mailbox Storage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <p className="text-3xl font-bold">
                  {stats?.used ? formatBytes(BigInt(stats.used)) : "0 B"}
                </p>
                <p className="text-sm text-muted-foreground">
                  of{" "}
                  {stats?.quota ? formatBytes(BigInt(stats.quota)) : "—"} used
                </p>
              </div>
              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Usage</span>
                  <span className="font-medium">{usagePercent}%</span>
                </div>
                <div className="h-3 rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${
                      usagePercent > 90
                        ? "bg-destructive"
                        : usagePercent > 75
                          ? "bg-yellow-500"
                          : "bg-primary"
                    }`}
                    style={{ width: `${Math.min(usagePercent, 100)}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Used</p>
                  <p className="font-medium">
                    {stats?.used ? formatBytes(BigInt(stats.used)) : "0 B"}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Remaining</p>
                  <p className="font-medium">
                    {stats?.remaining
                      ? formatBytes(BigInt(stats.remaining))
                      : "—"}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Mail is stored in Maildir format on the mail server. The database
                only tracks quota and usage statistics.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
