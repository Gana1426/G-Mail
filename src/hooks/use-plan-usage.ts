"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api.client";
import type { PlanUsageSummary } from "@/types/plan-usage";

export const PLAN_USAGE_QUERY_KEY = ["plan-usage"] as const;

export function usePlanUsage(enabled = true) {
  return useQuery({
    queryKey: PLAN_USAGE_QUERY_KEY,
    queryFn: async () => {
      const res = await api.get<PlanUsageSummary>("/plan/usage");
      return res.data!;
    },
    enabled,
    staleTime: 30_000,
  });
}

export function invalidatePlanUsage(queryClient: {
  invalidateQueries: (opts: { queryKey: readonly string[] }) => Promise<void>;
}) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [...PLAN_USAGE_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: ["org-dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["subscription-details"] }),
  ]);
}
