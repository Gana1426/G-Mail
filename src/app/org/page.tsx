"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/sidebar";
import { useOnboarding } from "@/hooks/use-onboarding";
import { StatCard } from "@/components/dashboard/stat-card";
import { api } from "@/services/api.client";
import { formatBytes, formatDateTime } from "@/utils";
import {
  Globe,
  Mail,
  HardDrive,
  CheckCircle2,
  Clock,
  Rocket,
  ArrowRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PlanUsageCard } from "@/components/org/plan-usage-card";
import { usePlanUsage } from "@/hooks/use-plan-usage";

interface DashboardData {
  organization?: { name: string };
  domains?: number;
  verifiedDomains?: number;
  pendingDomains?: number;
  mailboxes?: {
    total: number;
    active: number;
    totalQuota: string;
    totalUsed: string;
  };
  storage?: {
    quota: string;
    used: string;
    remaining: string;
  };
  recentMailboxes?: {
    id: string;
    email: string;
    displayName: string | null;
    status: string;
    domain?: string;
    createdAt: string;
  }[];
  recentActivity?: {
    id: string;
    action: string;
    resource: string;
    description: string | null;
    createdAt: string;
    user: { firstName: string; lastName: string } | null;
  }[];
  planUsage?: {
    domains: { used: number; limit: number };
    mailboxes: { used: number; limit: number };
    storage: { used: string; limit: string; percent: number };
    plan: { name: string; tier: string };
  };
}

export default function OrgDashboardPage() {
  const { data: onboarding, isLoading: onboardingLoading } = useOnboarding();
  const { data: planUsage } = usePlanUsage(!!onboarding);

  const domainLimitReached = planUsage?.domains.atLimit ?? false;

  const { data: stats, isLoading } = useQuery({
    queryKey: ["org-dashboard"],
    queryFn: async () => {
      const res = await api.get<DashboardData>("/dashboard");
      return res.data;
    },
    enabled: !!onboarding,
  });

  const onboardingSteps = [
    { label: "Select Plan", done: true },
    {
      label: "Add Domain",
      done: !!onboarding?.hasDomain,
    },
    {
      label: "Verify DNS",
      done: !!onboarding?.hasVerifiedDomain,
    },
    {
      label: "Create Mailboxes",
      done: false,
    },
  ];
  const completedSteps = onboardingSteps.filter((s) => s.done).length;

  return (
    <DashboardLayout variant="org" title="Dashboard">
      <div className="mb-6">
        <h2 className="text-lg font-medium">
          {stats?.organization?.name ?? "Organization"}
        </h2>
        <p className="text-muted-foreground">Organization overview</p>
      </div>

      {!onboardingLoading && onboarding && !onboarding.hasVerifiedDomain && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Rocket className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle>Getting Started</CardTitle>
                <CardDescription className="mt-1">
                  Add and verify your first domain to unlock mail hosting
                  features.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Onboarding Progress</span>
                <span className="text-muted-foreground">
                  {completedSteps} of {onboardingSteps.length} steps
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${(completedSteps / onboardingSteps.length) * 100}%`,
                  }}
                />
              </div>
              <div className="grid gap-2 pt-2 sm:grid-cols-2">
                {onboardingSteps.map((step) => (
                  <div
                    key={step.label}
                    className="flex items-center gap-2 text-sm"
                  >
                    {step.done ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span
                      className={
                        step.done ? "text-foreground" : "text-muted-foreground"
                      }
                    >
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!onboarding.hasDomain ? (
                domainLimitReached ? (
                  <Button asChild variant="outline">
                    <Link href="/org/subscription">Upgrade Plan</Link>
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href="/org/domains/new">
                      Add Domain
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                )
              ) : (
                <Button asChild>
                  <Link href={`/org/domains/${onboarding.domains[0]?.id}`}>
                    Verify DNS
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href="/org/domains">Manage Domains</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {onboardingLoading ? (
        <Skeleton className="mb-6 h-32 w-full" />
      ) : (
        onboarding &&
        onboarding.hasDomain && (
          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Domain Status
                </CardTitle>
                {onboarding.hasVerifiedDomain ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Clock className="h-4 w-4 text-amber-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-2xl font-bold">
                      {stats?.verifiedDomains ??
                        onboarding.verifiedDomainCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Verified</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {stats?.pendingDomains ??
                        onboarding.pendingDomainCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Your Domains
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {onboarding.domains.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <Link
                      href={`/org/domains/${d.id}`}
                      className="hover:text-primary hover:underline"
                    >
                      {d.name}
                    </Link>
                    <Badge
                      variant={
                        d.status === "VERIFIED" ? "success" : "warning"
                      }
                    >
                      {d.status === "VERIFIED" ? "Verified" : d.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Plan"
          value={stats?.planUsage?.plan.name ?? "—"}
          description={stats?.planUsage?.plan.tier}
          icon={HardDrive}
          loading={isLoading || onboardingLoading}
        />
        <StatCard
          title="Domains Used"
          value={
            stats?.planUsage
              ? `${stats.planUsage.domains.used} / ${
                  stats.planUsage.domains.limit === -1
                    ? "∞"
                    : stats.planUsage.domains.limit
                }`
              : "—"
          }
          icon={Globe}
          loading={isLoading || onboardingLoading}
        />
        <StatCard
          title="Mailboxes Used"
          value={
            stats?.planUsage
              ? `${stats.planUsage.mailboxes.used} / ${
                  stats.planUsage.mailboxes.limit === -1
                    ? "∞"
                    : stats.planUsage.mailboxes.limit
                }`
              : "—"
          }
          icon={Mail}
          loading={isLoading || onboardingLoading}
        />
        <StatCard
          title="Storage"
          value={
            stats?.planUsage?.storage.used
              ? formatBytes(BigInt(stats.planUsage.storage.used))
              : "0 B"
          }
          description={
            stats?.planUsage?.storage.limit
              ? `of ${formatBytes(BigInt(stats.planUsage.storage.limit))}`
              : undefined
          }
          icon={HardDrive}
          loading={isLoading || onboardingLoading}
        />
      </div>

      <div className="mb-6">
        <PlanUsageCard />
      </div>

      {onboarding?.hasVerifiedDomain && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent Mailboxes</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/org/mailboxes">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {(stats?.recentMailboxes ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No mailboxes yet.{" "}
                  <Link
                    href="/org/mailboxes/new"
                    className="text-primary hover:underline"
                  >
                    Create one
                  </Link>
                </p>
              ) : (
                stats?.recentMailboxes?.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{m.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.domain} · {formatDateTime(m.createdAt)}
                      </p>
                    </div>
                    <Badge
                      variant={
                        m.status === "ACTIVE" ? "success" : "secondary"
                      }
                    >
                      {m.status}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(stats?.recentActivity ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No recent activity
                </p>
              ) : (
                stats?.recentActivity?.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start justify-between gap-4 border-b pb-3 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {a.description ?? `${a.action} ${a.resource}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.user
                          ? `${a.user.firstName} ${a.user.lastName}`
                          : "System"}{" "}
                        · {formatDateTime(a.createdAt)}
                      </p>
                    </div>
                    <Badge variant="outline">{a.action}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
