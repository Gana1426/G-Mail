"use client";

import { useQuery } from "@tanstack/react-query";
import { mailApi } from "@mail-portal/services/api.client";
import type { MailSettings } from "@mail-portal/types/mail";

export function useMailSettings() {
  return useQuery({
    queryKey: ["mail-settings"],
    queryFn: async () => {
      const res = await mailApi.get<MailSettings>("/settings");
      return res.data!;
    },
  });
}

export function resolveSignatureContent(
  settings: MailSettings | undefined,
  mode: "new" | "reply" | "forward"
): string | null {
  if (!settings?.signatures?.length) return null;

  const id =
    mode === "new"
      ? settings.signatureForNew
      : mode === "reply"
        ? settings.signatureForReply
        : settings.signatureForForward;

  if (id) {
    const match = settings.signatures.find((s) => s.id === id);
    if (match) return match.content;
  }

  const fallback = settings.signatures.find((s) => s.isDefault) ?? settings.signatures[0];
  return fallback?.content ?? null;
}
