"use client";

import { useQuery } from "@tanstack/react-query";
import { mailApi } from "@mail-portal/services/api.client";
import type { MailMessageSummary, MailSearchQuery } from "@mail-portal/types/mail";

export interface MailSearchResult {
  messages: MailMessageSummary[];
  total: number;
  meta?: { totalPages: number; page: number; limit: number };
}

function buildSearchParams(query: MailSearchQuery): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === "" || value === false) return;
    params.set(key, String(value));
  });
  return params.toString();
}

export function useMailSearch(query: MailSearchQuery, enabled = true) {
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;

  return useQuery({
    queryKey: ["mail-search", query],
    enabled,
    queryFn: async () => {
      const qs = buildSearchParams(query);
      const res = await mailApi.get<MailSearchResult>(`/search?${qs}`);
      const total = res.data?.total ?? 0;
      return {
        messages: res.data?.messages ?? [],
        total,
        meta: {
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      };
    },
  });
}
