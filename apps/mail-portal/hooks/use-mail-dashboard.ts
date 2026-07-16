"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { mailApi } from "@mail-portal/services/api.client";
import type {
  MailDashboardStats,
  MailFolderInfo,
  MailProfile,
} from "@mail-portal/types/mail";

export function useMailProfile() {
  return useQuery({
    queryKey: ["mail-profile"],
    queryFn: async () => {
      const res = await mailApi.get<MailProfile>("/profile");
      return res.data!;
    },
  });
}

export function useMailDashboard() {
  return useQuery({
    queryKey: ["mail-dashboard"],
    queryFn: async () => {
      const res = await mailApi.get<MailDashboardStats>("/dashboard");
      return res.data!;
    },
  });
}

export function useMailFolders() {
  return useQuery({
    queryKey: ["mail-folders"],
    queryFn: async () => {
      const res = await mailApi.get<MailFolderInfo[]>("/folders");
      return res.data ?? [];
    },
  });
}

export function invalidateMailQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["mail-dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["mail-folders"] }),
    queryClient.invalidateQueries({ queryKey: ["mail-messages"] }),
    queryClient.invalidateQueries({ queryKey: ["mail-notifications"] }),
  ]);
}
