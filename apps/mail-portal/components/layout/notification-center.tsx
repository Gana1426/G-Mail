"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, CheckCheck, Trash2, Loader2, Mail } from "lucide-react";
import { cn } from "@/utils";
import { MailAvatar } from "@mail-portal/components/mail/mail-avatar";
import {
  useMailNotifications,
  getNotificationFingerprint,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  requestBrowserNotificationPermission,
  showBrowserNotification,
} from "@mail-portal/hooks/use-mail-notifications";

interface IncomingMailMetadata {
  senderName?: string;
  senderEmail?: string;
  subject?: string;
  receivedAt?: string;
}

export function NotificationCenter() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isFetching } = useMailNotifications();
  const seenIds = useRef<Set<string>>(new Set());
  const seenFingerprints = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  useEffect(() => {
    requestBrowserNotificationPermission();
  }, []);

  useEffect(() => {
    if (!notifications.length) return;

    if (!initialized.current) {
      notifications.forEach((n) => {
        seenIds.current.add(n.id);
        seenFingerprints.current.add(getNotificationFingerprint(n));
      });
      initialized.current = true;
      return;
    }

    for (const notification of notifications) {
      if (seenIds.current.has(notification.id)) continue;
      const fingerprint = getNotificationFingerprint(notification);
      seenIds.current.add(notification.id);
      if (seenFingerprints.current.has(fingerprint)) continue;
      seenFingerprints.current.add(fingerprint);
      if (!notification.isRead) {
        const meta = notification.metadata as IncomingMailMetadata;
        showBrowserNotification(
          meta.senderName ?? notification.title,
          meta.subject ?? notification.message,
          notification.link ?? undefined
        );
      }
    }
  }, [notifications]);

  const handleOpen = async (id: string, link: string | null) => {
    try {
      await markNotificationRead(queryClient, id);
      if (link) router.push(link);
    } catch (error) {
      toast({
        title: "Couldn't mark notification as read",
        description: error instanceof Error ? error.message : "Request failed",
        variant: "destructive",
      });
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8" title="Notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-0.5 -top-0.5 h-4 min-w-4 px-1 text-[10px]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[400px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">New mail</h3>
          <div className="flex items-center gap-1">
            {isFetching && !isLoading && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={async () => {
                  try {
                    await markAllNotificationsRead(queryClient);
                    toast({ title: "All notifications marked as read" });
                  } catch (error) {
                    toast({
                      title: "Couldn't update notifications",
                      description: error instanceof Error ? error.message : "Request failed",
                      variant: "destructive",
                    });
                  }
                }}
              >
                <CheckCheck className="mr-1 h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Mail className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No new mail notifications</p>
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((notification) => {
                const meta = notification.metadata as IncomingMailMetadata;
                const senderName = meta.senderName ?? notification.title;
                const senderEmail = meta.senderEmail ?? "";
                const subject = meta.subject ?? notification.message;
                const receivedAt = meta.receivedAt ?? notification.createdAt;

                return (
                  <li
                    key={notification.id}
                    className={cn(
                      "border-l-4 border-l-[#0f6cbd] px-4 py-3",
                      !notification.isRead && "bg-muted/40"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <MailAvatar name={senderName} email={senderEmail} size="sm" />
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() =>
                            handleOpen(notification.id, notification.link)
                          }
                        >
                          <p className="text-sm font-semibold">{senderName}</p>
                          {senderEmail && (
                            <p className="truncate text-xs text-muted-foreground">
                              {senderEmail}
                            </p>
                          )}
                          <p className="mt-1 truncate text-sm">{subject}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(receivedAt), {
                              addSuffix: true,
                            })}
                          </p>
                        </button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        title="Delete"
                        onClick={async () => {
                          try {
                            await deleteNotification(queryClient, notification.id);
                          } catch (error) {
                            toast({
                              title: "Couldn't delete notification",
                              description:
                                error instanceof Error ? error.message : "Request failed",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
