"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { mailApi } from "@mail-portal/services/api.client";
import { invalidateMailQueries } from "@mail-portal/hooks/use-mail-dashboard";
import type { MailFolderId, MailMessageSummary } from "@mail-portal/types/mail";

export function useMailMessages(
  folder: MailFolderId,
  options: { page?: number; q?: string } = {}
) {
  const page = options.page ?? 1;
  const q = options.q ?? "";

  return useQuery({
    queryKey: ["mail-messages", folder, page, q],
    queryFn: async () => {
      const params = new URLSearchParams({
        folder,
        page: String(page),
        limit: "25",
      });
      if (q) params.set("q", q);
      const res = await mailApi.get<MailMessageSummary[]>(
        `/inbox?${params.toString()}`
      );
      return {
        messages: res.data ?? [],
        meta: res.meta,
      };
    },
    refetchInterval: folder === "INBOX" ? 30_000 : 60_000,
  });
}

export function useMailMessage(uid: string | null) {
  const queryClient = useQueryClient();
  const invalidatedFor = useRef<string | null>(null);

  const query = useQuery({
    queryKey: ["mail-message", uid],
    queryFn: async () => {
      if (!uid) return null;
      const res = await mailApi.get<import("@mail-portal/types/mail").MailMessageDetail>(
        `/messages/${encodeURIComponent(uid)}`
      );
      return res.data ?? null;
    },
    enabled: !!uid,
  });

  useEffect(() => {
    if (!uid || !query.data) return;
    if (invalidatedFor.current === uid) return;
    invalidatedFor.current = uid;
    void invalidateMailQueries(queryClient);
  }, [uid, query.data, queryClient]);

  return query;
}
