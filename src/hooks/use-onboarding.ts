"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api.client";

export interface OnboardingStatus {
  hasDomain: boolean;
  hasVerifiedDomain: boolean;
  domainCount: number;
  verifiedDomainCount: number;
  pendingDomainCount: number;
  canCreateMailboxes: boolean;
  onboardingComplete: boolean;
  domains: {
    id: string;
    name: string;
    status: string;
    verifiedAt: string | null;
  }[];
}

export function useOnboarding(enabled = true) {
  return useQuery({
    queryKey: ["onboarding-status"],
    queryFn: async () => {
      const res = await api.get<OnboardingStatus>("/onboarding/status");
      return res.data!;
    },
    staleTime: 5_000,
    refetchOnWindowFocus: true,
    enabled,
  });
}
