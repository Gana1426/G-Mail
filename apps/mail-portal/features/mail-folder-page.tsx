"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { MailLayout, useMailLayout } from "@mail-portal/components/layout/mail-layout";
import { MessageList } from "@mail-portal/components/mail/message-list";
import { MessageView } from "@mail-portal/components/mail/message-view";
import { useMailMessages, useMailMessage } from "@mail-portal/hooks/use-mail-messages";
import { invalidateMailQueries } from "@mail-portal/hooks/use-mail-dashboard";
import { useMailSettings } from "@mail-portal/hooks/use-mail-settings";
import { mailApi } from "@mail-portal/services/api.client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { getFolderLabel } from "@mail-portal/lib/folders";
import type { MailFolderId, MailMessageSummary } from "@mail-portal/types/mail";

const FOLDER_MAP: Record<string, MailFolderId> = {
  inbox: "INBOX",
  sent: "SENT",
  drafts: "DRAFTS",
  spam: "SPAM",
  trash: "TRASH",
  archive: "ARCHIVE",
  starred: "STARRED",
  important: "IMPORTANT",
  outbox: "OUTBOX",
};

interface MailFolderPageProps {
  folderSlug: string;
}

export function MailFolderPage({ folderSlug }: MailFolderPageProps) {
  return (
    <MailLayout>
      <MailFolderContent folderSlug={folderSlug} />
    </MailLayout>
  );
}

function MailFolderContent({ folderSlug }: MailFolderPageProps) {
  const folder = FOLDER_MAP[folderSlug] ?? "INBOX";
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const layout = useMailLayout();
  const { data: settings } = useMailSettings();

  const [page, setPage] = useState(1);
  const [accumulatedMessages, setAccumulatedMessages] = useState<MailMessageSummary[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedUid, setSelectedUid] = useState<string | null>(searchParams.get("uid"));
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());

  const readingPaneWidth = settings?.readingPaneWidth ?? 480;
  const previewPane = settings?.previewPane ?? "right";
  const density = settings?.messageDensity ?? "comfortable";

  const { data, isLoading, refetch, isFetching } = useMailMessages(folder, { page });
  const { data: message, isLoading: messageLoading } = useMailMessage(selectedUid);

  useEffect(() => {
    setPage(1);
    setAccumulatedMessages([]);
    setSelectedUid(null);
    setSelectedUids(new Set());
  }, [folderSlug]);

  useEffect(() => {
    if (message?.uid && selectedUid && message.uid !== selectedUid) {
      setSelectedUid(message.uid);
    }
  }, [message?.uid, selectedUid]);

  const messages = useMemo(() => {
    const base =
      accumulatedMessages.length > 0
        ? accumulatedMessages
        : (data?.messages ?? []);
    if (!settings?.conversationView) return base;
    const threads = new Map<string, typeof base[number]>();
    for (const message of base) {
      const key = (message.subject || "")
        .replace(/^(re|fwd?):\s*/gi, "")
        .trim()
        .toLowerCase();
      const existing = threads.get(key);
      if (!existing || new Date(message.date) > new Date(existing.date)) {
        threads.set(key, message);
      }
    }
    return [...threads.values()].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [accumulatedMessages, data?.messages, page, settings?.conversationView]);

  const totalPages = data?.meta?.totalPages ?? 1;
  const hasMore = page < totalPages;

  useEffect(() => {
    if (!data?.messages) return;
    if (page === 1) {
      setAccumulatedMessages(data.messages);
    } else {
      setAccumulatedMessages((prev) => {
        const seen = new Set(prev.map((m) => m.uid));
        const next = [...prev];
        for (const message of data.messages) {
          if (!seen.has(message.uid)) next.push(message);
        }
        return next;
      });
    }
    setLoadingMore(false);
  }, [data?.messages, page]);

  const handleRefresh = useCallback(async () => {
    await invalidateMailQueries(queryClient);
    await refetch();
  }, [queryClient, refetch]);

  useEffect(() => {
    layout?.registerRefresh(handleRefresh);
  }, [layout, handleRefresh]);

  useEffect(() => {
    const intervalSec = settings?.autoRefreshInterval ?? 0;
    if (!intervalSec || intervalSec <= 0) return;
    const id = window.setInterval(() => {
      void handleRefresh();
    }, intervalSec * 1000);
    return () => window.clearInterval(id);
  }, [settings?.autoRefreshInterval, handleRefresh]);

  const runAction = useCallback(
    async (action: string, uids: string[], targetFolder?: MailFolderId) => {
      try {
        await mailApi.post("/messages/actions", {
          action,
          uids,
          ...(targetFolder ? { targetFolder } : {}),
        });
        const messages: Record<string, string> = {
          delete:
            folder === "DRAFTS"
              ? "Draft moved to trash"
              : "Message moved to trash",
          deletePermanent: "Permanently deleted",
          restore: "Message restored",
          archive: "Archived",
          move: "Moved to inbox",
          markRead: "Marked as read",
          markUnread: "Marked as unread",
          spam: "Moved to junk",
          notSpam: "Moved to inbox",
          star: "Starred",
          unstar: "Unstarred",
        };
        toast({ title: messages[action] ?? "Done" });
        await invalidateMailQueries(queryClient);
        await queryClient.invalidateQueries({ queryKey: ["mail-notifications"] });
        refetch();
        if (
          (action === "delete" || action === "deletePermanent") &&
          selectedUid &&
          uids.includes(selectedUid)
        ) {
          setSelectedUid(null);
        }
        setSelectedUids(new Set());
      } catch (error) {
        toast({
          title: "Action failed",
          description: error instanceof Error ? error.message : "Request failed",
          variant: "destructive",
        });
      }
    },
    [queryClient, refetch, selectedUid, toast, folder]
  );

  const toggleSelect = (uid: string) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const bulkUids = useMemo(
    () => (selectedUids.size > 0 ? [...selectedUids] : selectedUid ? [selectedUid] : []),
    [selectedUids, selectedUid]
  );

  const handleSelectMessage = useCallback(
    (uid: string) => {
      if (folder === "DRAFTS") {
        router.push(`/mail-portal/compose?draft=${encodeURIComponent(uid)}`);
        return;
      }
      setSelectedUid(uid);
    },
    [folder, router]
  );

  const showReadingPane = previewPane !== "off";

  return (
    <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b bg-white px-4 py-2 dark:bg-background">
          <h2 className="text-sm font-semibold">{getFolderLabel(folder)}</h2>
          {data?.meta?.total !== undefined && (
            <span className="text-xs text-muted-foreground">{data.meta.total} messages</span>
          )}
        </div>

        {bulkUids.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b bg-[#faf9f8] px-4 py-2 dark:bg-muted/30">
            {folder === "TRASH" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runAction("restore", bulkUids)}
                >
                  Restore
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => runAction("deletePermanent", bulkUids)}
                >
                  Delete permanently
                </Button>
              </>
            ) : folder === "DRAFTS" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runAction("delete", bulkUids)}
                >
                  Delete
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => runAction("deletePermanent", bulkUids)}
                >
                  Delete permanently
                </Button>
              </>
            ) : folder === "ARCHIVE" ? (
              <>
                <Button size="sm" variant="outline" onClick={() => runAction("move", bulkUids, "INBOX")}>
                  Move to inbox
                </Button>
                <Button size="sm" variant="outline" onClick={() => runAction("delete", bulkUids)}>
                  Delete
                </Button>
              </>
            ) : folder === "SPAM" ? (
              <>
                <Button size="sm" variant="outline" onClick={() => runAction("notSpam", bulkUids)}>
                  Not spam
                </Button>
                <Button size="sm" variant="outline" onClick={() => runAction("delete", bulkUids)}>
                  Delete
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => runAction("archive", bulkUids)}>
                  Archive
                </Button>
                <Button size="sm" variant="outline" onClick={() => runAction("delete", bulkUids)}>
                  Delete
                </Button>
                <Button size="sm" variant="outline" onClick={() => runAction("markRead", bulkUids)}>
                  Mark read
                </Button>
                <Button size="sm" variant="outline" onClick={() => runAction("spam", bulkUids)}>
                  Spam
                </Button>
              </>
            )}
          </div>
        )}

        <div
          className={
            previewPane === "bottom"
              ? "flex min-h-0 flex-1 flex-col"
              : "flex min-h-0 flex-1"
          }
        >
          <div
            className={
              previewPane === "bottom"
                ? "flex max-h-[45%] shrink-0 flex-col border-b"
                : "flex w-[380px] shrink-0 flex-col border-r"
            }
          >
            <MessageList
              folder={folder}
              messages={messages}
              loading={isLoading && page === 1}
              selectedUid={selectedUid}
              selectedUids={selectedUids}
              onSelect={handleSelectMessage}
              onToggleSelect={toggleSelect}
              onSelectAll={(checked) =>
                setSelectedUids(checked ? new Set(messages.map((m) => m.uid)) : new Set())
              }
              density={density}
              folderLabel={getFolderLabel(folder)}
              hasMore={hasMore}
              loadingMore={loadingMore || (isFetching && page > 1)}
              onLoadMore={() => {
                if (!hasMore || loadingMore || isFetching) return;
                setLoadingMore(true);
                setPage((p) => p + 1);
              }}
              onQuickAction={(uid, action) => {
                if (action === "open") {
                  setSelectedUid(uid);
                  return;
                }
                if (action === "edit") {
                  router.push(`/mail-portal/compose?draft=${encodeURIComponent(uid)}`);
                  return;
                }
                if (action === "unarchive") {
                  void runAction("move", [uid], "INBOX");
                  return;
                }
                const map = {
                  star: "star",
                  unstar: "unstar",
                  archive: "archive",
                  delete: "delete",
                  deletePermanent: "deletePermanent",
                  restore: "restore",
                  notSpam: "notSpam",
                } as const;
                if (action in map) {
                  void runAction(map[action as keyof typeof map], [uid]);
                }
              }}
            />
            {totalPages > 1 && page >= totalPages && (
              <p className="border-t py-2 text-center text-xs text-muted-foreground">
                End of folder
              </p>
            )}
          </div>

          {showReadingPane && (
            <div
              className="min-w-0 flex-1"
              style={previewPane === "right" ? { minWidth: readingPaneWidth } : undefined}
            >
              <MessageView
                message={message ?? undefined}
                loading={messageLoading && !!selectedUid}
                onReply={() =>
                  router.push(`/mail-portal/compose?reply=${encodeURIComponent(selectedUid!)}`)
                }
                onReplyAll={() =>
                  router.push(
                    `/mail-portal/compose?replyAll=${encodeURIComponent(selectedUid!)}`
                  )
                }
                onForward={() =>
                  router.push(
                    `/mail-portal/compose?forward=${encodeURIComponent(selectedUid!)}`
                  )
                }
                onDelete={() => selectedUid && runAction("delete", [selectedUid])}
                onArchive={() => selectedUid && runAction("archive", [selectedUid])}
                onStar={() => selectedUid && runAction("star", [selectedUid])}
                onSpam={() => selectedUid && runAction("spam", [selectedUid])}
                onRestore={
                  folder === "TRASH" && selectedUid
                    ? () => runAction("restore", [selectedUid])
                    : undefined
                }
                onDeletePermanent={
                  folder === "TRASH" && selectedUid
                    ? () => runAction("deletePermanent", [selectedUid])
                    : undefined
                }
              />
            </div>
          )}
        </div>
      </div>
  );
}
