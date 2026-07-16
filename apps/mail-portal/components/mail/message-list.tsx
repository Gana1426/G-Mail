"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/utils";
import type { MailFolderId, MailMessageSummary, MessageDensity } from "@mail-portal/types/mail";
import { Checkbox } from "@mail-portal/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { MailAvatar } from "@mail-portal/components/mail/mail-avatar";
import { HighlightText } from "@mail-portal/components/mail/highlight-text";
import { MessageContextMenu } from "@mail-portal/components/mail/message-context-menu";
import { formatMailListDate } from "@mail-portal/lib/format-mail-date";
import {
  Star,
  Paperclip,
  Loader2,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
  FolderOpen,
  Archive,
  ArchiveRestore,
  AlertOctagon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type MessageQuickAction =
  | "star"
  | "unstar"
  | "archive"
  | "unarchive"
  | "delete"
  | "deletePermanent"
  | "restore"
  | "notSpam"
  | "edit"
  | "open";

export type MessageContextAction = MessageQuickAction;

interface MessageListProps {
  folder?: MailFolderId;
  messages: MailMessageSummary[];
  loading?: boolean;
  selectedUid: string | null;
  selectedUids: Set<string>;
  onSelect: (uid: string) => void;
  onToggleSelect: (uid: string) => void;
  onSelectAll: (checked: boolean) => void;
  searchQuery?: string;
  density?: MessageDensity;
  folderLabel?: string;
  emptyMessage?: string;
  onQuickAction?: (uid: string, action: MessageQuickAction) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

const DENSITY_PADDING: Record<MessageDensity, string> = {
  compact: "py-2",
  comfortable: "py-3",
  spacious: "py-4",
};

type QuickActionDef = {
  action: MessageQuickAction;
  icon: typeof Star;
  label: string;
  destructive?: boolean;
};

type ContextMenuItemDef = {
  label: string;
  icon: typeof Star;
  onClick: () => void;
  destructive?: boolean;
};

function getQuickActions(
  folder: MailFolderId,
  message: MailMessageSummary
): QuickActionDef[] {
  const starAction: QuickActionDef = message.isStarred
    ? { action: "unstar", icon: Star, label: "Unstar" }
    : { action: "star", icon: Star, label: "Star" };

  switch (folder) {
    case "INBOX":
      return [
        starAction,
        { action: "archive", icon: Archive, label: "Archive" },
        { action: "delete", icon: Trash2, label: "Move to trash", destructive: true },
      ];
    case "SENT":
      return [
        starAction,
        { action: "delete", icon: Trash2, label: "Move to trash", destructive: true },
      ];
    case "DRAFTS":
      return [
        starAction,
        { action: "edit", icon: Pencil, label: "Edit draft" },
        { action: "delete", icon: Trash2, label: "Move to trash", destructive: true },
        {
          action: "deletePermanent",
          icon: Trash2,
          label: "Delete permanently",
          destructive: true,
        },
      ];
    case "ARCHIVE":
      return [
        { action: "unarchive", icon: ArchiveRestore, label: "Move to inbox" },
        starAction,
        { action: "delete", icon: Trash2, label: "Move to trash", destructive: true },
      ];
    case "SPAM":
      return [
        { action: "notSpam", icon: AlertOctagon, label: "Not spam" },
        { action: "delete", icon: Trash2, label: "Delete", destructive: true },
        starAction,
      ];
    case "TRASH":
      return [
        { action: "restore", icon: RotateCcw, label: "Restore" },
        {
          action: "deletePermanent",
          icon: Trash2,
          label: "Delete permanently",
          destructive: true,
        },
      ];
    default:
      return [
        starAction,
        { action: "delete", icon: Trash2, label: "Move to trash", destructive: true },
      ];
  }
}

function getContextMenuItems(
  folder: MailFolderId,
  message: MailMessageSummary,
  onQuickAction?: (uid: string, action: MessageQuickAction) => void
): ContextMenuItemDef[] {
  const uid = message.uid;
  const quick = getQuickActions(folder, message);
  const openItem: ContextMenuItemDef = {
    label: folder === "DRAFTS" ? "Open draft" : "Open",
    icon: folder === "DRAFTS" ? Pencil : FolderOpen,
    onClick: () => onQuickAction?.(uid, folder === "DRAFTS" ? "edit" : "open"),
  };

  return [
    openItem,
    ...quick.map((item) => ({
      label: item.label,
      icon: item.icon,
      onClick: () => onQuickAction?.(uid, item.action),
      destructive: item.destructive,
    })),
  ];
}

export function MessageList({
  folder = "INBOX",
  messages,
  loading,
  selectedUid,
  selectedUids,
  onSelect,
  onToggleSelect,
  onSelectAll,
  searchQuery,
  density = "comfortable",
  folderLabel,
  emptyMessage = "No messages in this folder",
  onQuickAction,
  hasMore,
  loadingMore,
  onLoadMore,
}: MessageListProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || !onLoadMore || loadingMore) return;
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: "120px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore, messages.length]);

  if (loading) {
    return (
      <div className="divide-y">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex gap-3 px-3 py-3">
            <Skeleton className="h-4 w-4 shrink-0" />
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
        <p className="text-sm font-medium text-foreground">Nothing here yet</p>
        <p className="text-xs">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full flex-col bg-white dark:bg-background">
        <div className="flex items-center gap-3 border-b px-3 py-2">
          <Checkbox
            checked={selectedUids.size === messages.length && messages.length > 0}
            onCheckedChange={(c) => onSelectAll(!!c)}
          />
          <span className="text-xs font-medium text-muted-foreground">
            {folderLabel ?? (selectedUids.size > 0 ? `${selectedUids.size} selected` : "Select all")}
          </span>
        </div>
        <div className="flex-1 divide-y overflow-y-auto">
          {messages.map((message) => {
            const senderName = message.from.name ?? message.from.address;
            const quickActions = getQuickActions(message.folder, message);
            const contextItems = getContextMenuItems(message.folder, message, onQuickAction);

            const row = (
              <div
                className={cn(
                  "group flex cursor-pointer gap-2 px-3 transition-colors hover:bg-[#f3f2f1] dark:hover:bg-muted/50",
                  DENSITY_PADDING[density],
                  selectedUid === message.uid && "bg-[#edebe9] dark:bg-muted/60",
                  !message.isRead && "border-l-2 border-l-[#0f6cbd] bg-[#faf9f8] dark:bg-muted/20"
                )}
                onClick={() => onSelect(message.uid)}
              >
                <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedUids.has(message.uid)}
                    onCheckedChange={() => onToggleSelect(message.uid)}
                  />
                </div>
                <MailAvatar
                  name={message.from.name}
                  email={message.from.address}
                  size="sm"
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "truncate text-sm",
                            !message.isRead ? "font-semibold text-foreground" : "text-foreground/90"
                          )}
                        >
                          <HighlightText text={senderName} query={searchQuery} />
                        </span>
                        {!message.isRead && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-[#0f6cbd]"
                            title="Unread"
                          />
                        )}
                      </div>
                      <p
                        className={cn(
                          "truncate text-sm",
                          !message.isRead ? "font-medium" : "text-foreground/80"
                        )}
                      >
                        <HighlightText
                          text={message.subject || "(No subject)"}
                          query={searchQuery}
                        />
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        <HighlightText text={message.preview} query={searchQuery} />
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[11px] text-muted-foreground group-hover:hidden">
                        {formatMailListDate(message.date)}
                      </span>
                      <div className="hidden items-center gap-0.5 group-hover:flex">
                        {onQuickAction &&
                          quickActions.map((item) => (
                            <Tooltip key={`${item.action}-${item.label}`}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className={cn(
                                    "rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground",
                                    item.destructive && "hover:text-destructive",
                                    item.action === "star" &&
                                      message.isStarred &&
                                      "text-amber-500"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onQuickAction(message.uid, item.action);
                                  }}
                                >
                                  <item.icon
                                    className={cn(
                                      "h-3.5 w-3.5",
                                      item.action === "star" &&
                                        message.isStarred &&
                                        "fill-amber-400 text-amber-400"
                                    )}
                                  />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>{item.label}</TooltipContent>
                            </Tooltip>
                          ))}
                        {onQuickAction && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {contextItems.map((item) => (
                                <DropdownMenuItem
                                  key={item.label}
                                  className={cn(item.destructive && "text-destructive")}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    item.onClick();
                                  }}
                                >
                                  <item.icon className="mr-2 h-4 w-4" />
                                  {item.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      <div className="flex items-center gap-1 group-hover:hidden">
                        {message.isStarred && (
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        )}
                        {message.hasAttachments && (
                          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );

            if (!onQuickAction) {
              return <div key={message.uid}>{row}</div>;
            }

            return (
              <MessageContextMenu key={message.uid} items={contextItems}>
                {row}
              </MessageContextMenu>
            );
          })}
          {hasMore && (
            <div ref={loadMoreRef} className="flex justify-center py-4">
              {loadingMore && (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              )}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
