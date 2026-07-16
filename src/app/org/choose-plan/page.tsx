"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/sidebar";
import { api } from "@/services/api.client";
import { useToast } from "@/hooks/use-toast";
import { useBilling } from "@/hooks/use-billing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes } from "@/utils";
import { Check, Loader2, CreditCard } from "lucide-react";
import Script from "next/script";

interface PlanOption {
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
  currency: string;
  isFree: boolean;
}

export default function ChoosePlanPage() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: billing } = useBilling();
  const [interval, setInterval] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [razorpayReady, setRazorpayReady] = useState(false);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["billing-plans"],
    queryFn: async () => {
      const res = await api.get<PlanOption[]>("/billing/plans");
      return res.data ?? [];
    },
  });

  const invalidateBilling = async () => {
    await queryClient.invalidateQueries({ queryKey: ["billing-status"] });
    await queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
  };

  const goToDashboard = async () => {
    await invalidateBilling();
    router.push("/org");
  };

  const selectFreePlan = async (planId: string) => {
    setLoadingPlanId(planId);
    try {
      await api.post("/billing/select-plan", { planId, interval });
      toast({
        title: "Plan activated",
        description: "Your free plan is ready. Welcome to MailHost!",
      });
      await goToDashboard();
    } catch (error) {
      toast({
        title: "Activation failed",
        description: error instanceof Error ? error.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setLoadingPlanId(null);
    }
  };

  const startPaidCheckout = async (planId: string) => {
    setLoadingPlanId(planId);
    try {
      const res = await api.post<{
        orderId: string;
        amount: number;
        currency: string;
        keyId: string;
        prefill: { name: string; email: string };
      }>("/billing/create-order", { planId, interval });

      const order = res.data!;
      if (!window.Razorpay) {
        throw new Error("Razorpay SDK not loaded");
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "MailHost Platform",
        description: "Subscription plan payment",
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
            toast({
              title: "Payment successful",
              description: "Your plan is now active.",
            });
            await goToDashboard();
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
        title: "Checkout failed",
        description: error instanceof Error ? error.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setLoadingPlanId(null);
    }
  };

  const handleSelect = (plan: PlanOption) => {
    if (plan.isFree) {
      selectFreePlan(plan.id);
    } else {
      if (!razorpayReady) {
        toast({
          title: "Payment gateway loading",
          description: "Please wait a moment and try again.",
          variant: "destructive",
        });
        return;
      }
      startPaidCheckout(plan.id);
    }
  };

  const getPrice = (plan: PlanOption) =>
    interval === "YEARLY" ? plan.yearlyPrice : plan.monthlyPrice;

  useEffect(() => {
    if (billing?.canAccessDashboard) {
      router.replace("/org");
    }
  }, [billing, router]);

  if (billing?.canAccessDashboard) {
    return null;
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setRazorpayReady(true)}
      />
      <DashboardLayout variant="org" title="Choose Your Plan">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Select a plan to continue
            </h2>
            <p className="text-muted-foreground mt-2">
              Free plan activates instantly. Paid plans require Razorpay checkout.
            </p>
            <div className="mt-4 inline-flex rounded-lg border p-1">
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
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-3">
              <Skeleton className="h-80" />
              <Skeleton className="h-80" />
              <Skeleton className="h-80" />
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {plans?.map((plan) => {
                const price = getPrice(plan);
                const isLoadingThis = loadingPlanId === plan.id;

                return (
                  <Card
                    key={plan.id}
                    className={
                      plan.tier === "PRO"
                        ? "border-primary shadow-md"
                        : undefined
                    }
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>{plan.name}</CardTitle>
                        {plan.isFree && (
                          <Badge variant="secondary">Free</Badge>
                        )}
                        {plan.tier === "PRO" && (
                          <Badge variant="default">Popular</Badge>
                        )}
                      </div>
                      <CardDescription>{plan.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <span className="text-3xl font-bold">
                          {plan.isFree
                            ? "Free"
                            : `₹${price.toFixed(2)}`}
                        </span>
                        {!plan.isFree && (
                          <span className="text-muted-foreground text-sm">
                            /{interval === "YEARLY" ? "year" : "month"}
                          </span>
                        )}
                      </div>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary" />
                          {plan.maxDomains === -1
                            ? "Unlimited domains"
                            : `${plan.maxDomains} domain(s)`}
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary" />
                          {plan.maxMailboxes === -1
                            ? "Unlimited mailboxes"
                            : `${plan.maxMailboxes} mailbox(es)`}
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary" />
                          {formatBytes(BigInt(plan.storageQuotaBytes))} storage
                        </li>
                        {plan.aliasesEnabled && (
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-primary" />
                            Aliases
                          </li>
                        )}
                        {plan.forwardersEnabled && (
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-primary" />
                            Forwarders
                          </li>
                        )}
                      </ul>
                    </CardContent>
                    <CardFooter>
                      <Button
                        className="w-full"
                        variant={plan.isFree ? "outline" : "default"}
                        disabled={isLoadingThis}
                        onClick={() => handleSelect(plan)}
                      >
                        {isLoadingThis && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {plan.isFree ? (
                          "Start Free"
                        ) : (
                          <>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Pay with Razorpay
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
    </>
  );
}
