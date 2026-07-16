"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { mailApi } from "@mail-portal/services/api.client";

export interface MailNotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: MailNotificationItem[];
  unreadCount: number;
}

export function useMailNotifications() {
  return useQuery({
    queryKey: ["mail-notifications"],
    queryFn: async () => {
      const res = await mailApi.get<NotificationsResponse>("/notifications");
      return res.data ?? { notifications: [], unreadCount: 0 };
    },
    refetchInterval: 30_000,
  });
}

export async function markNotificationRead(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string
) {
  await mailApi.patch("/notifications", { action: "markRead", id });
  await queryClient.invalidateQueries({ queryKey: ["mail-notifications"] });
}

export async function markAllNotificationsRead(
  queryClient: ReturnType<typeof useQueryClient>
) {
  await mailApi.patch("/notifications", { action: "markAllRead" });
  await queryClient.invalidateQueries({ queryKey: ["mail-notifications"] });
}

export async function deleteNotification(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string
) {
  await mailApi.delete("/notifications", { id });
  await queryClient.invalidateQueries({ queryKey: ["mail-notifications"] });
}

export function requestBrowserNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

export function showBrowserNotification(title: string, body: string, link?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const notification = new Notification(title, {
    body,
    icon: "/favicon.ico",
  });
  if (link) {
    notification.onclick = () => {
      window.focus();
      window.location.href = link;
    };
  }
}

export function getNotificationFingerprint(notification: MailNotificationItem): string {
  return [
    notification.type,
    notification.title.trim().toLowerCase(),
    notification.message.trim().toLowerCase(),
    notification.link ?? "",
  ].join("::");
}
