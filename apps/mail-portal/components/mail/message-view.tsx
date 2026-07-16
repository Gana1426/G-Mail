"use client";

import { formatDateTime } from "@/utils";
import { formatAddressList } from "@mail-portal/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MailAvatar } from "@mail-portal/components/mail/mail-avatar";
import type { MailMessageDetail } from "@mail-portal/types/mail";
import {
  Reply,
  ReplyAll,
  Forward,
  Trash2,
  Archive,
  Star,
  Printer,
  Download,
  AlertOctagon,
  RotateCcw,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MessageViewProps {
  message: MailMessageDetail | null | undefined;
  loading?: boolean;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onStar: () => void;
  onSpam: () => void;
  onRestore?: () => void;
  onDeletePermanent?: () => void;
}

export function MessageView({
  message,
  loading,
  onReply,
  onReplyAll,
  onForward,
  onDelete,
  onArchive,
  onStar,
  onSpam,
  onRestore,
  onDeletePermanent,
}: MessageViewProps) {
  if (loading) {
    return (
      <div className="flex h-full flex-col bg-white p-6 dark:bg-background">
        <Skeleton className="mb-4 h-8 w-2/3" />
        <div className="mb-6 flex gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!message) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-white text-muted-foreground dark:bg-background">
        <p className="text-sm">Select a message to read</p>
      </div>
    );
  }

  const handlePrint = () => window.print();
  const handleDownload = () => {
    window.open(
      `/api/mail/messages/${encodeURIComponent(message.uid)}?format=eml`,
      "_blank"
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white dark:bg-background">
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-[#faf9f8] px-2 py-1.5 dark:bg-muted/20">
        <Button variant="ghost" size="sm" className="h-8" onClick={onReply}>
          <Reply className="mr-1.5 h-4 w-4" /> Reply
        </Button>
        <Button variant="ghost" size="sm" className="h-8" onClick={onReplyAll}>
          <ReplyAll className="mr-1.5 h-4 w-4" /> Reply all
        </Button>
        <Button variant="ghost" size="sm" className="h-8" onClick={onForward}>
          <Forward className="mr-1.5 h-4 w-4" /> Forward
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        {onRestore && (
          <Button variant="ghost" size="sm" className="h-8" onClick={onRestore}>
            <RotateCcw className="mr-1.5 h-4 w-4" /> Restore
          </Button>
        )}
        {onDeletePermanent ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-destructive"
            onClick={onDeletePermanent}
          >
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete permanently
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete} title="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        {!onDeletePermanent && (
          <>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onArchive} title="Archive">
              <Archive className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onStar} title="Star">
              <Star className="h-4 w-4" />
            </Button>
          </>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={onSpam}>
              <AlertOctagon className="mr-2 h-4 w-4" />
              Report junk
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download EML
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <h1 className="mb-4 text-xl font-semibold leading-snug">
          {message.subject || "(No subject)"}
        </h1>

        <div className="mb-6 flex gap-3">
          <MailAvatar name={message.from.name} email={message.from.address} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  {message.from.name ?? message.from.address}
                </p>
                <p className="text-xs text-muted-foreground">{message.from.address}</p>
              </div>
              <p className="shrink-0 text-xs text-muted-foreground">
                {formatDateTime(message.date)}
              </p>
            </div>
            <div className="mt-2 space-y-0.5 text-sm">
              <p>
                <span className="text-muted-foreground">To: </span>
                {formatAddressList(message.to)}
              </p>
              {message.cc && message.cc.length > 0 && (
                <p>
                  <span className="text-muted-foreground">Cc: </span>
                  {formatAddressList(message.cc)}
                </p>
              )}
              {message.bcc && message.bcc.length > 0 && (
                <p>
                  <span className="text-muted-foreground">Bcc: </span>
                  {formatAddressList(message.bcc)}
                </p>
              )}
            </div>
          </div>
        </div>

        {message.attachments.length > 0 && (
          <div className="mb-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Attachments ({message.attachments.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {message.attachments.map((att) => (
                <a
                  key={att.id}
                  href={`/api/mail/messages/${encodeURIComponent(message.uid)}/attachments/${encodeURIComponent(att.id)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border bg-[#faf9f8] px-3 py-2 text-xs hover:bg-muted dark:bg-muted/30"
                >
                  {att.filename} ({Math.max(1, Math.round(att.size / 1024))} KB)
                </a>
              ))}
            </div>
          </div>
        )}

        <div
          className="prose prose-sm max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{
            __html: message.html ?? `<pre class="whitespace-pre-wrap font-sans text-sm">${message.text ?? ""}</pre>`,
          }}
        />
      </div>
    </div>
  );
}
