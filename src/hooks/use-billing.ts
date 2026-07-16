"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api.client";

export interface BillingStatus {
  subscriptionStatus: string;
  needsPlanSelection: boolean;
  needsPayment: boolean;
  canAccessDashboard: boolean;
  currentPlan: {
    id: string;
    name: string;
    tier: string;
    code: string;
  } | null;
  pendingPayment: {
    id: string;
    planId: string;
    planName: string;
    amount: number;
    currency: string;
    interval: string;
    razorpayOrderId: string | null;
  } | null;
  planActivatedAt: string | null;
}

export function useBilling(enabled = true) {
  return useQuery({
    queryKey: ["billing-status"],
    queryFn: async () => {
      const res = await api.get<BillingStatus>("/billing/status");
      return res.data!;
    },
    staleTime: 15_000,
    enabled,
    retry: 1,
  });
}
