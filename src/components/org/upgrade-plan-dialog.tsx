"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlanUsage } from "@/hooks/use-plan-usage";
import { api } from "@/services/api.client";
import { formatBytes } from "@/utils";
import { ArrowUpCircle, Check } from "lucide-react";

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  tier: string;
  description: string | null;
  maxDomains: number;
  maxMailboxes: number;
  storageQuotaBytes: string;
  aliasesEnabled: boolean;
  forwardersEnabled: boolean;
  monthlyPrice: number;
  isCurrent: boolean;
  isFree: boolean;
}

function formatPlanLimit(value: number) {
  return value === -1 ? "Unlimited" : String(value);
}

export function UpgradePlanDialog({
  open,
  onOpenChange,
  title = "You've reached your current plan limit.",
  description = "Upgrade your subscription to increase domains, mailboxes, and storage.",
}: UpgradePlanDialogProps) {
  const { data: usage, isLoading: usageLoading } = usePlanUsage(open);

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["subscription-details"],
    queryFn: async () => {
      const res = await api.get<{ plans: SubscriptionPlan[] }>(
        "/billing/subscription"
      );
      return res.data?.plans ?? [];
    },
    enabled: open,
    staleTime: 60_000,
  });

  const loading = usageLoading || plansLoading;
  const upgradePlans = (plans ?? []).filter((p) => !p.isCurrent);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {usage && (
              <div className="rounded-lg border p-4">
                <p className="mb-2 text-sm font-medium">Current Plan</p>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{usage.plan.name}</span>
                  <Badge variant="outline">{usage.plan.tier}</Badge>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  <li>
                    Domains: {usage.domains.used} /{" "}
                    {formatPlanLimit(usage.plan.maxDomains)} used
                  </li>
                  <li>
                    Mailboxes: {usage.mailboxes.used} /{" "}
                    {formatPlanLimit(usage.plan.maxMailboxes)} used
                  </li>
                  <li>
                    Storage: {formatBytes(BigInt(usage.storage.used))} /{" "}
                    {formatBytes(BigInt(usage.storage.limit))}
                  </li>
                  <li>
                    Aliases: {usage.aliasesEnabled ? "Enabled" : "Not available"}
                  </li>
                  <li>
                    Forwarders:{" "}
                    {usage.forwardersEnabled ? "Enabled" : "Not available"}
                  </li>
                </ul>
              </div>
            )}

            {upgradePlans.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">Available Plans</p>
                <div className="space-y-2">
                  {upgradePlans.slice(0, 3).map((plan) => (
                    <div
                      key={plan.id}
                      className="rounded-lg border bg-muted/20 p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{plan.name}</span>
                        <span className="text-muted-foreground">
                          {plan.isFree
                            ? "Free"
                            : `₹${plan.monthlyPrice}/mo`}
                        </span>
                      </div>
                      {plan.description && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {plan.description}
                        </p>
                      )}
                      <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                        <li className="flex items-center gap-1">
                          <Check className="h-3 w-3 text-green-500" />
                          {formatPlanLimit(plan.maxDomains)} domains
                        </li>
                        <li className="flex items-center gap-1">
                          <Check className="h-3 w-3 text-green-500" />
                          {formatPlanLimit(plan.maxMailboxes)} mailboxes
                        </li>
                        <li className="flex items-center gap-1">
                          <Check className="h-3 w-3 text-green-500" />
                          {formatBytes(BigInt(plan.storageQuotaBytes))} storage
                        </li>
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
              <p className="font-medium">Benefits of upgrading</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <ArrowUpCircle className="h-4 w-4 text-primary" />
                  Add more domains and mailboxes
                </li>
                <li className="flex items-center gap-2">
                  <ArrowUpCircle className="h-4 w-4 text-primary" />
                  Increase organization storage quota
                </li>
                <li className="flex items-center gap-2">
                  <ArrowUpCircle className="h-4 w-4 text-primary" />
                  Unlock aliases and forwarders on higher tiers
                </li>
              </ul>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button asChild>
            <Link href="/org/subscription" onClick={() => onOpenChange(false)}>
              Upgrade Plan
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
