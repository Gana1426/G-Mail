"use client";

import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/sidebar";
import { api } from "@/services/api.client";
import { openWebmail } from "@/lib/webmail";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes, formatDateTime } from "@/utils";
import { Mail, ExternalLink } from "lucide-react";

interface MailboxStats {
  email?: string;
  quota?: string;
  used?: string;
  remaining?: string;
  usagePercent?: number;
  status?: string;
  vacationEnabled?: boolean;
}

export default function PortalMailboxPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["portal-dashboard"],
    queryFn: () => api.get<MailboxStats>("/dashboard"),
  });

  const stats = data?.data;

  return (
    <DashboardLayout variant="portal" title="My Mailbox">
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Mailbox Overview</CardTitle>
              <Badge variant={stats?.status === "ACTIVE" ? "success" : "secondary"}>
                {stats?.status ?? "—"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email Address</span>
                  <span className="font-medium">{stats?.email ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Storage Used</span>
                  <span>
                    {stats?.used ? formatBytes(BigInt(stats.used)) : "0 B"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Storage Limit</span>
                  <span>
                    {stats?.quota ? formatBytes(BigInt(stats.quota)) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Remaining</span>
                  <span>
                    {stats?.remaining
                      ? formatBytes(BigInt(stats.remaining))
                      : "—"}
                  </span>
                </div>
              </div>
              {stats?.usagePercent != null && (
                <div>
                  <div className="mb-1 flex justify-between text-sm text-muted-foreground">
                    <span>Usage</span>
                    <span>{stats.usagePercent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.min(stats.usagePercent, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              <Button className="w-full" onClick={() => openWebmail()}>
                <Mail className="mr-2 h-4 w-4" />
                Open Webmail
                <ExternalLink className="ml-auto h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mail Delivery</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Incoming mail is delivered via Postfix to your Maildir storage on
                the mail server. Email contents are stored in your mailbox
                folder, not in the application database.
              </p>
              <p>
                Outgoing mail is sent through SMTP via Postfix to the internet.
              </p>
              <div className="rounded-lg border bg-muted/50 p-3 font-mono text-xs">
                Internet → Postfix → Dovecot → Maildir → Mailbox
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
