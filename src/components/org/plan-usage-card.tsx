"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PlanUsageBar } from "@/components/org/plan-usage-bar";
import { usePlanUsage } from "@/hooks/use-plan-usage";
import { api } from "@/services/api.client";
import { formatBytes } from "@/utils";
import { Gauge } from "lucide-react";

interface SubscriptionPlan {
  id: string;
  name: string;
  tier: string;
  maxDomains: number;
  maxMailboxes: number;
  storageQuotaBytes: string;
  isCurrent: boolean;
}

export function PlanUsageCard({ compact = false }: { compact?: boolean }) {
  const { data: usage, isLoading } = usePlanUsage();

  const { data: plans } = useQuery({
    queryKey: ["subscription-details"],
    queryFn: async () => {
      const res = await api.get<{ plans: SubscriptionPlan[] }>(
        "/billing/subscription"
      );
      return res.data?.plans ?? [];
    },
    enabled: !!usage,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!usage) return null;

  const storageUsed = formatBytes(BigInt(usage.storage.used));
  const storageLimit = formatBytes(BigInt(usage.storage.limit));

  return (
    <Card>
      <CardHeader className={compact ? "pb-3" : undefined}>
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Plan Usage</CardTitle>
        </div>
        <CardDescription>
          {usage.plan.name} · {usage.plan.tier}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <PlanUsageBar label="Domains" usage={usage.domains} />
        <PlanUsageBar label="Mailboxes" usage={usage.mailboxes} />
        <PlanUsageBar
          label="Storage"
          usage={{
            used: usage.storage.percent,
            limit: 100,
            percent: usage.storage.percent,
            atLimit: usage.storage.atLimit,
            remaining: null,
          }}
          valueLabel={`${storageUsed} / ${storageLimit}`}
          showPercent={false}
        />

        {!compact && plans && plans.length > 0 && (
          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Current limits</p>
            <ul className="space-y-0.5">
              <li>
                Domains:{" "}
                {usage.plan.maxDomains === -1
                  ? "Unlimited"
                  : usage.plan.maxDomains}
              </li>
              <li>
                Mailboxes:{" "}
                {usage.plan.maxMailboxes === -1
                  ? "Unlimited"
                  : usage.plan.maxMailboxes}
              </li>
              <li>Storage: {storageLimit}</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PlanLimitBannerProps {
  message: string;
  onUpgrade?: () => void;
}

export function PlanLimitBanner({ message, onUpgrade }: PlanLimitBannerProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-destructive">{message}</p>
      <div className="flex shrink-0 gap-2">
        {onUpgrade ? (
          <button
            type="button"
            onClick={onUpgrade}
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Upgrade Plan
          </button>
        ) : (
          <Link
            href="/org/subscription"
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Upgrade Plan
          </Link>
        )}
      </div>
    </div>
  );
}
