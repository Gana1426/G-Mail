"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { MailLayout } from "@mail-portal/components/layout/mail-layout";
import { MessageList } from "@mail-portal/components/mail/message-list";
import { MessageView } from "@mail-portal/components/mail/message-view";
import { useMailSearch } from "@mail-portal/hooks/use-mail-search";
import { useMailMessage } from "@mail-portal/hooks/use-mail-messages";
import { useMailSettings } from "@mail-portal/hooks/use-mail-settings";
import { invalidateMailQueries } from "@mail-portal/hooks/use-mail-dashboard";
import { mailApi } from "@mail-portal/services/api.client";
import { buildHighlightQuery } from "@mail-portal/lib/mail-search-filter";
import { getFolderLabel } from "@mail-portal/lib/folders";
import type { MailFolderId } from "@mail-portal/types/mail";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Filter } from "lucide-react";
const FOLDERS: MailFolderId[] = [
  "INBOX",
  "SENT",
  "DRAFTS",
  "SPAM",
  "TRASH",
  "ARCHIVE",
  "STARRED",
  "IMPORTANT",
];

export function MailSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: settings } = useMailSettings();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");
  const [subject, setSubject] = useState(searchParams.get("subject") ?? "");
  const [body, setBody] = useState(searchParams.get("body") ?? "");
  const [folder, setFolder] = useState<MailFolderId | "">(
    (searchParams.get("folder") as MailFolderId) ?? ""
  );
  const [hasAttachment, setHasAttachment] = useState(
    searchParams.get("hasAttachment") === "true"
  );
  const [isUnread, setIsUnread] = useState(searchParams.get("isUnread") === "true");
  const [isRead, setIsRead] = useState(searchParams.get("isRead") === "true");
  const [isStarred, setIsStarred] = useState(searchParams.get("isStarred") === "true");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") ?? "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") ?? "");
  const [page, setPage] = useState(parseInt(searchParams.get("page") ?? "1", 10));
  const [showFilters, setShowFilters] = useState(false);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [debouncedQ, setDebouncedQ] = useState(q);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q), 350);
    return () => window.clearTimeout(timer);
  }, [q]);

  const searchQuery = useMemo(
    () => ({
      q: debouncedQ || undefined,
      from: from || undefined,
      to: to || undefined,
      subject: subject || undefined,
      body: body || undefined,
      folder: folder || undefined,
      hasAttachment: hasAttachment || undefined,
      isUnread: isUnread || undefined,
      isRead: isRead || undefined,
      isStarred: isStarred || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
      limit: 25,
    }),
    [
      debouncedQ,
      from,
      to,
      subject,
      body,
      folder,
      hasAttachment,
      isUnread,
      isRead,
      isStarred,
      dateFrom,
      dateTo,
      page,
    ]
  );

  const hasQuery = Boolean(
    debouncedQ ||
      from ||
      to ||
      subject ||
      body ||
      folder ||
      hasAttachment ||
      isUnread ||
      isRead ||
      isStarred ||
      dateFrom ||
      dateTo
  );

  const highlightQuery = useMemo(
    () =>
      buildHighlightQuery({
        q: debouncedQ,
        from,
        to,
        subject,
        body,
      }),
    [debouncedQ, from, to, subject, body]
  );

  const runAction = useCallback(
    async (action: string, uids: string[], targetFolder?: MailFolderId) => {
      try {
        await mailApi.post("/messages/actions", {
          action,
          uids,
          ...(targetFolder ? { targetFolder } : {}),
        });
        toast({ title: "Done" });
        await invalidateMailQueries(queryClient);
        await queryClient.invalidateQueries({ queryKey: ["mail-search"] });
        if (action === "delete" && selectedUid && uids.includes(selectedUid)) {
          setSelectedUid(null);
        }
      } catch (error) {
        toast({
          title: "Action failed",
          description: error instanceof Error ? error.message : "Request failed",
          variant: "destructive",
        });
      }
    },
    [queryClient, selectedUid, toast]
  );

  const { data, isLoading, isFetching } = useMailSearch(searchQuery, hasQuery);
  const { data: message, isLoading: messageLoading } = useMailMessage(selectedUid);

  const messages = data?.messages ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;

  return (
    <MailLayout>
      <div className="flex h-full flex-col">
        <div className="border-b bg-white px-4 py-3 dark:bg-background">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">Search</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter className="mr-1 h-4 w-4" />
              Filters
              {showFilters ? (
                <ChevronUp className="ml-1 h-4 w-4" />
              ) : (
                <ChevronDown className="ml-1 h-4 w-4" />
              )}
            </Button>
            {hasQuery && (
              <span className="text-sm text-muted-foreground">
                {isFetching ? "Searching…" : `${data?.total ?? 0} results`}
              </span>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search all mail..."
              className="max-w-xl"
            />
          </div>

          {showFilters && (
            <Card className="mt-3">
              <CardContent className="grid gap-4 pt-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>From</Label>
                  <Input value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <Input value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Body</Label>
                  <Input value={body} onChange={(e) => setBody(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Folder</Label>
                  <Select
                    value={folder || "all"}
                    onValueChange={(v) => setFolder(v === "all" ? "" : (v as MailFolderId))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All folders" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All folders</SelectItem>
                      {FOLDERS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {getFolderLabel(f)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date from</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Date to</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <div className="flex flex-col justify-end gap-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={hasAttachment}
                      onChange={(e) => setHasAttachment(e.target.checked)}
                    />
                    Has attachment
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isUnread}
                      onChange={(e) => {
                        setIsUnread(e.target.checked);
                        if (e.target.checked) setIsRead(false);
                      }}
                    />
                    Unread only
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isRead}
                      onChange={(e) => {
                        setIsRead(e.target.checked);
                        if (e.target.checked) setIsUnread(false);
                      }}
                    />
                    Read only
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isStarred}
                      onChange={(e) => setIsStarred(e.target.checked)}
                    />
                    Starred only
                  </label>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {!hasQuery ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Enter a search term or apply filters to find messages
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <div className="flex w-[380px] shrink-0 flex-col border-r">
              <MessageList
                messages={messages}
                loading={isLoading}
                selectedUid={selectedUid}
                selectedUids={new Set()}
                onSelect={setSelectedUid}
                onToggleSelect={() => {}}
                onSelectAll={() => {}}
                searchQuery={highlightQuery}
                density={settings?.messageDensity}
                folderLabel={`${data?.total ?? 0} results`}
                emptyMessage="No messages match your search"
                onQuickAction={(uid, action) => {
                  const msg = messages.find((m) => m.uid === uid);
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
                  void msg;
                }}
              />
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t p-2 text-sm">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
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
              />
            </div>
          </div>
        )}
      </div>
    </MailLayout>
  );
}
