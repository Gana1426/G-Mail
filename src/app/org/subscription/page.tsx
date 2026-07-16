"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Script from "next/script";
import { DashboardLayout } from "@/components/layout/sidebar";
import { api, getApiErrorMessage } from "@/services/api.client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatBytes,
  formatCurrency,
  formatDateTime,
  formatLimit,
  toSafeBigInt,
} from "@/utils";
import { Check, CreditCard, Loader2, ArrowUpCircle, RefreshCw } from "lucide-react";

interface SubscriptionDetails {
  subscriptionStatus: string;
  currentPlan: { id: string; name: string; tier: string; code: string } | null;
  planActivatedAt: string | null;
  billingCycle?: string;
  startDate?: string | null;
  expiryDate?: string | null;
  isHighestPlan?: boolean;
  usage?: {
    domains: { used: number; limit: number };
    mailboxes: { used: number; limit: number };
    storage: { used: string; limit: string; percent: number };
  };
  plans: Array<{
    id: string;
    code: string;
    name: string;
    tier: string;
    description: string | null;
    maxDomains: number;
    maxMailboxes: number;
    storageQuotaBytes: string;
    aliasesEnabled: boolean;
    forwardersEnabled: boolean;
    monthlyPrice: number;
    yearlyPrice: number;
    isFree: boolean;
    isCurrent: boolean;
  }>;
}

export default function OrgSubscriptionPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [interval, setInterval] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [razorpayReady, setRazorpayReady] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["subscription-details"],
    queryFn: async () => {
      const res = await api.get<SubscriptionDetails>("/billing/subscription");
      return res.data ?? null;
    },
  });

  const usage = data?.usage;
  const domainsUsed = usage?.domains?.used ?? 0;
  const domainsLimit = usage?.domains?.limit ?? 0;
  const mailboxesUsed = usage?.mailboxes?.used ?? 0;
  const mailboxesLimit = usage?.mailboxes?.limit ?? 0;
  const storageUsed = toSafeBigInt(usage?.storage?.used);
  const storageLimit = toSafeBigInt(usage?.storage?.limit);
  const storagePercent = usage?.storage?.percent ?? 0;

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["subscription-details"] });
    await queryClient.invalidateQueries({ queryKey: ["billing-status"] });
    await queryClient.invalidateQueries({ queryKey: ["org-dashboard"] });
  };

  const handleUpgrade = async (planId: string, isFree: boolean) => {
    setLoadingPlanId(planId);
    try {
      if (isFree) {
        await api.post("/billing/subscription", { planId, interval });
        toast({ title: "Plan updated successfully" });
        setShowUpgrade(false);
        await invalidate();
        return;
      }

      if (!razorpayReady) {
        toast({
          title: "Payment gateway loading",
          variant: "destructive",
        });
        return;
      }

      const res = await api.post<{
        free?: boolean;
        upgraded?: boolean;
        orderId?: string;
        amount?: number;
        currency?: string;
        keyId?: string;
        prefill?: { name: string; email: string };
      }>("/billing/subscription", { planId, interval });

      if (res.data?.free || res.data?.upgraded) {
        toast({ title: "Plan updated successfully" });
        setShowUpgrade(false);
        await invalidate();
        return;
      }

      const order = res.data!;
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "MailHost Platform",
        description: "Plan upgrade",
        order_id: order.orderId,
        prefill: order.prefill,
        theme: { color: "#2563eb" },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await api.post("/billing/verify", {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast({ title: "Plan upgraded successfully" });
            setShowUpgrade(false);
            await invalidate();
          } catch (error) {
            toast({
              title: "Payment verification failed",
              description:
                error instanceof Error ? error.message : "Contact support",
              variant: "destructive",
            });
          }
        },
      });
      rzp.open();
    } catch (error) {
      toast({
        title: "Upgrade failed",
        description: error instanceof Error ? error.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setLoadingPlanId(null);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout variant="org" title="Subscription">
        <Skeleton className="h-64 w-full" />
      </DashboardLayout>
    );
  }

  if (isError || !data) {
    return (
      <DashboardLayout variant="org" title="Subscription">
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="text-muted-foreground">
            {getApiErrorMessage(error, "Failed to load subscription details.")}
          </p>
          <Button variant="outline" onClick={() => void refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const getPrice = (plan: SubscriptionDetails["plans"][0]) =>
    interval === "YEARLY" ? plan.yearlyPrice : plan.monthlyPrice;

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setRazorpayReady(true)}
      />
      <DashboardLayout variant="org" title="Subscription">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-muted-foreground">
            Manage your organization subscription and usage limits
          </p>
          {data.isHighestPlan ?? false ? (
            <Badge variant="secondary">Current Highest Plan</Badge>
          ) : (
            <Button onClick={() => setShowUpgrade(true)}>
              <ArrowUpCircle className="mr-2 h-4 w-4" />
              Upgrade Plan
            </Button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Current Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">
                  {data.currentPlan?.name ?? "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan Status</span>
                <Badge
                  variant={
                    data.subscriptionStatus === "ACTIVE" ? "success" : "warning"
                  }
                >
                  {data.subscriptionStatus}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Billing Cycle</span>
                <span>
                  {data.billingCycle === "YEARLY" ? "Yearly" : "Monthly"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Start Date</span>
                <span>
                  {formatDateTime(data.startDate ?? data.planActivatedAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expiry Date</span>
                <span>{formatDateTime(data.expiryDate)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage & Limits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <div className="mb-1 flex justify-between">
                  <span className="text-muted-foreground">Domains</span>
                  <span>
                    {domainsUsed} / {formatLimit(domainsLimit)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${
                        domainsLimit === -1
                          ? 0
                          : Math.min(
                              (domainsUsed / domainsLimit) * 100,
                              100
                            )
                      }%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between">
                  <span className="text-muted-foreground">Mailboxes</span>
                  <span>
                    {mailboxesUsed} / {formatLimit(mailboxesLimit)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${
                        mailboxesLimit === -1
                          ? 0
                          : Math.min(
                              (mailboxesUsed / mailboxesLimit) * 100,
                              100
                            )
                      }%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between">
                  <span className="text-muted-foreground">Storage</span>
                  <span>
                    {formatBytes(storageUsed)} / {formatBytes(storageLimit)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(storagePercent, 100)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Dialog open={showUpgrade} onOpenChange={setShowUpgrade}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upgrade Plan</DialogTitle>
            </DialogHeader>
            <div className="mb-4 inline-flex rounded-lg border p-1">
              <Button
                variant={interval === "MONTHLY" ? "default" : "ghost"}
                size="sm"
                onClick={() => setInterval("MONTHLY")}
              >
                Monthly
              </Button>
              <Button
                variant={interval === "YEARLY" ? "default" : "ghost"}
                size="sm"
                onClick={() => setInterval("YEARLY")}
              >
                Yearly
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.plans.map((plan) => {
                const price = getPrice(plan);
                const isCurrent = plan.isCurrent;
                const isLoadingThis = loadingPlanId === plan.id;

                return (
                  <Card
                    key={plan.id}
                    className={
                      isCurrent ? "border-primary ring-1 ring-primary" : undefined
                    }
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{plan.name}</CardTitle>
                        {isCurrent && <Badge>Current</Badge>}
                      </div>
                      <CardDescription>{plan.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-2xl font-bold">
                        {plan.isFree
                          ? "Free"
                          : formatCurrency(price)}
                      </p>
                      <ul className="space-y-1 text-xs">
                        <li className="flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          {formatLimit(plan.maxDomains)} domain(s)
                        </li>
                        <li className="flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          {formatLimit(plan.maxMailboxes)} mailbox(es)
                        </li>
                        <li className="flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          {formatBytes(toSafeBigInt(plan.storageQuotaBytes))}
                        </li>
                      </ul>
                      <Button
                        className="w-full"
                        variant={isCurrent ? "outline" : "default"}
                        disabled={isCurrent || isLoadingThis}
                        onClick={() => handleUpgrade(plan.id, plan.isFree)}
                      >
                        {isLoadingThis && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {isCurrent ? (
                          "Current Plan"
                        ) : plan.isFree ? (
                          "Switch to Free"
                        ) : (
                          <>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Upgrade
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </>
  );
}
