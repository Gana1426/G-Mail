"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { MailLayout } from "@mail-portal/components/layout/mail-layout";
import { RichTextEditor } from "@mail-portal/components/mail/rich-text-editor";
import { RecipientInput, validateRecipientList } from "@mail-portal/components/mail/recipient-input";
import { useMailMessage } from "@mail-portal/hooks/use-mail-messages";
import { mailApi } from "@mail-portal/services/api.client";
import { invalidateMailQueries, useMailProfile } from "@mail-portal/hooks/use-mail-dashboard";
import { useMailSettings, resolveSignatureContent } from "@mail-portal/hooks/use-mail-settings";
import { formatAddress } from "@mail-portal/lib/format";
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
import { Loader2, Send, Save, X, Paperclip, Minus, Maximize2, Minimize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MAX_ATTACHMENT_SIZE_BYTES } from "@mail-portal/lib/constants";
import { cn } from "@/utils";

function plainTextToHtml(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
    .join("");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildQuotedMessageHtml(
  sourceMessage: NonNullable<ReturnType<typeof useMailMessage>["data"]>
): string {
  const quotedBody = sourceMessage.html
    ? sourceMessage.html
    : `<pre class="whitespace-pre-wrap font-sans text-sm">${escapeHtml(
        sourceMessage.text ?? ""
      )}</pre>`;

  return `<p><br/></p><p>On ${new Date(
    sourceMessage.date
  ).toLocaleString()}, ${sourceMessage.from.address} wrote:</p><blockquote>${quotedBody}</blockquote>`;
}

export function ComposePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const draftParam = searchParams.get("draft");
  const replyParam = searchParams.get("reply");
  const replyAllParam = searchParams.get("replyAll");
  const forwardParam = searchParams.get("forward");
  const sourceUid = draftParam ?? replyParam ?? replyAllParam ?? forwardParam;

  const { data: sourceMessage, isLoading: loadingSource } = useMailMessage(sourceUid);

  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [editorMode, setEditorMode] = useState<"html" | "plain">("html");
  const [priority, setPriority] = useState<"normal" | "high" | "low">("normal");
  const [readReceipt, setReadReceipt] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftUid, setDraftUid] = useState<string | undefined>();
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const [signatureApplied, setSignatureApplied] = useState(false);
  const [selectedSignatureId, setSelectedSignatureId] = useState<string>("none");
  const [windowMode, setWindowMode] = useState<"normal" | "minimized" | "maximized" | "popout">(
    "normal"
  );
  const autoSaveTimer = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const { data: profile } = useMailProfile();
  const { data: settings } = useMailSettings();

  const fromAddress = profile
    ? formatAddress({
        name: profile.displayName ?? undefined,
        address: profile.email,
      })
    : "";

  const [attachments, setAttachments] = useState<
    Array<{
      filename: string;
      contentType: string;
      content: string;
      size?: number;
      previewUrl?: string;
      progress?: number;
    }>
  >([]);

  const composeMode = draftParam
    ? "draft"
    : replyParam || replyAllParam
      ? "reply"
      : forwardParam
        ? "forward"
        : "new";

  const hasUnsavedChanges =
    to.length > 0 ||
    cc.length > 0 ||
    bcc.length > 0 ||
    subject.trim().length > 0 ||
    body.replace(/<[^>]*>/g, "").trim().length > 0 ||
    attachments.length > 0;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = scrollTopRef.current;
  }, [windowMode]);

  const handleComposeScroll = () => {
    if (scrollContainerRef.current) {
      scrollTopRef.current = scrollContainerRef.current.scrollTop;
    }
  };

  useEffect(() => {
    if (!settings) return;
    if (settings.readReceiptsDefault) setReadReceipt(true);
  }, [settings]);

  const appendSignature = useCallback(
    (html: string, mode: "new" | "reply" | "forward") => {
      const sig =
        selectedSignatureId !== "none"
          ? settings?.signatures.find((s) => s.id === selectedSignatureId)?.content
          : resolveSignatureContent(settings, mode);
      if (!sig) return html;
      const sigBlock = `<p><br/></p>${sig}`;
      if (mode === "new") return `${html}${sigBlock}`;
      return `${sigBlock}${html}`;
    },
    [selectedSignatureId, settings]
  );

  useEffect(() => {
    if (!settings || signatureApplied || draftParam) return;
    if (sourceUid && !loadedSource) return;

    if (!sourceUid && composeMode === "new") {
      const sig = resolveSignatureContent(settings, "new");
      if (sig) setBody(sig);
      setSignatureApplied(true);
    }
  }, [settings, signatureApplied, draftParam, sourceUid, loadedSource, composeMode]);

  useEffect(() => {
    if (!sourceMessage || !sourceUid || loadedSource === sourceUid) return;

    if (draftParam) {
      setTo(sourceMessage.to.map((t) => t.address));
      setCc(sourceMessage.cc?.map((c) => c.address) ?? []);
      setBcc(sourceMessage.bcc?.map((b) => b.address) ?? []);
      setSubject(sourceMessage.subject === "(No subject)" ? "" : sourceMessage.subject);
      setBody(sourceMessage.html ?? sourceMessage.text ?? "");
      setShowCc((sourceMessage.cc?.length ?? 0) > 0);
      setShowBcc((sourceMessage.bcc?.length ?? 0) > 0);
      setDraftUid(sourceUid);
      setEditorMode(sourceMessage.html ? "html" : "plain");

      if (sourceMessage.attachments?.length) {
        void (async () => {
          const loaded: Array<{
            filename: string;
            contentType: string;
            content: string;
            size?: number;
            previewUrl?: string;
            progress?: number;
          }> = [];
          for (const att of sourceMessage.attachments ?? []) {
            try {
              const res = await fetch(
                `/api/mail/messages/${encodeURIComponent(sourceUid!)}/attachments/${encodeURIComponent(att.id)}`,
                { credentials: "include" }
              );
              if (!res.ok) continue;
              const blob = await res.blob();
              const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const result = reader.result as string;
                  resolve(result.split(",")[1] ?? "");
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              loaded.push({
                filename: att.filename,
                contentType: att.contentType,
                content: base64,
                size: att.size,
                progress: 100,
              });
            } catch {
              // skip failed attachment
            }
          }
          if (loaded.length) setAttachments(loaded);
        })();
      }
    } else if (replyParam || replyAllParam) {
      const currentUserEmail = profile?.email.toLowerCase();
      const uniqueAddresses = (values: string[]) => {
        const seen = new Set<string>();
        return values.filter((value) => {
          const normalized = value.trim().toLowerCase();
          if (!normalized) return false;
          if (normalized === currentUserEmail) return false;
          if (seen.has(normalized)) return false;
          seen.add(normalized);
          return true;
        });
      };

      const replyTo = uniqueAddresses([sourceMessage.from.address]);
      const replyAllTo = uniqueAddresses([
        sourceMessage.from.address,
        ...sourceMessage.to.map((t) => t.address),
      ]);
      const replyAllCc = uniqueAddresses(
        sourceMessage.cc?.map((c) => c.address) ?? []
      ).filter(
        (address) =>
          !replyAllTo.some(
            (toAddress) => toAddress.toLowerCase() === address.toLowerCase()
          )
      );

      setTo(replyAllParam ? replyAllTo : replyTo);
      setCc(replyAllParam ? replyAllCc : []);
      setBcc([]);
      setShowCc(Boolean(replyAllParam && replyAllCc.length > 0));
      setShowBcc(false);
      setSubject(
        sourceMessage.subject.startsWith("Re:")
          ? sourceMessage.subject
          : `Re: ${sourceMessage.subject}`
      );
      setBody(
        appendSignature(
          buildQuotedMessageHtml(sourceMessage),
          "reply"
        )
      );
    } else if (forwardParam) {
      setTo([]);
      setCc([]);
      setBcc([]);
      setShowCc(false);
      setShowBcc(false);
      setSubject(
        sourceMessage.subject.startsWith("Fwd:")
          ? sourceMessage.subject
          : `Fwd: ${sourceMessage.subject}`
      );
      setBody(
        appendSignature(
          `<p><br/></p><p>---------- Forwarded message ----------</p>${buildQuotedMessageHtml(
            sourceMessage
          )}`,
          "forward"
        )
      );
    }

    setLoadedSource(sourceUid);
    setSignatureApplied(true);
  }, [
    sourceMessage,
    sourceUid,
    loadedSource,
    draftParam,
    replyParam,
    replyAllParam,
    forwardParam,
    appendSignature,
    profile?.email,
  ]);

  const handleSend = async () => {
    if (!to.length) {
      toast({ title: "Add at least one recipient", variant: "destructive" });
      return;
    }

    const emailError = validateRecipientList([...to, ...cc, ...bcc]);
    if (emailError) {
      toast({ title: emailError, variant: "destructive" });
      return;
    }

    if (!body.trim()) {
      toast({ title: "Message body is required", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const replyHeaders =
        sourceMessage && (replyParam || replyAllParam)
          ? {
              inReplyTo: sourceMessage.messageId,
              references: [
                ...(sourceMessage.references ?? []),
                ...(sourceMessage.messageId ? [sourceMessage.messageId] : []),
              ],
            }
          : {};

      await mailApi.post("/send", {
        to,
        cc: cc.length ? cc : undefined,
        bcc: bcc.length ? bcc : undefined,
        subject,
        html: editorMode === "html" ? body : plainTextToHtml(body),
        text: editorMode === "plain" ? body : undefined,
        priority,
        requestReadReceipt: readReceipt,
        attachments,
        draftUid,
        ...replyHeaders,
      });
      toast({ title: "Message sent successfully" });
      await invalidateMailQueries(queryClient);
      router.push("/mail-portal/mail/sent");
    } catch (error) {
      toast({
        title: "Unable to send email.",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = useCallback(
    async (silent = false) => {
      const emailError = validateRecipientList([...to, ...cc, ...bcc]);
      if (emailError) {
        if (!silent) toast({ title: emailError, variant: "destructive" });
        return;
      }

      setSaving(true);
      try {
        const res = await mailApi.post<{ draftUid: string }>("/drafts", {
          to,
          cc: cc.length ? cc : undefined,
          bcc: bcc.length ? bcc : undefined,
          subject,
          html: editorMode === "html" ? body : plainTextToHtml(body),
          text: editorMode === "plain" ? body : undefined,
          draftUid,
          attachments,
        });
        if (res.data?.draftUid) {
          setDraftUid(res.data.draftUid);
        }
        if (!silent) toast({ title: "Draft saved successfully." });
        await invalidateMailQueries(queryClient);
      } catch (error) {
        if (!silent) {
          toast({
            title: "Failed to save draft.",
            description: error instanceof Error ? error.message : undefined,
            variant: "destructive",
          });
        }
      } finally {
        setSaving(false);
      }
    },
    [to, cc, bcc, subject, body, editorMode, draftUid, attachments, toast, queryClient]
  );

  useEffect(() => {
    if (!settings?.autoSaveDraft) return;
    const interval = (settings.autoSaveDraftInterval ?? 30) * 1000;
    if (autoSaveTimer.current) window.clearInterval(autoSaveTimer.current);
    autoSaveTimer.current = window.setInterval(() => {
      if (to.length || subject || body.trim()) {
        void handleSaveDraft(true);
      }
    }, interval);
    return () => {
      if (autoSaveTimer.current) window.clearInterval(autoSaveTimer.current);
    };
  }, [settings?.autoSaveDraft, settings?.autoSaveDraftInterval, handleSaveDraft, to, subject, body]);

  const handleDiscardConfirm = async () => {
    setDiscarding(true);
    try {
      if (draftUid) {
        await mailApi.post("/messages/actions", {
          action: "deletePermanent",
          uids: [draftUid],
        });
        await invalidateMailQueries(queryClient);
      }
      setDiscardOpen(false);
      router.back();
    } catch (error) {
      toast({
        title: "Failed to discard",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setDiscarding(false);
    }
  };

  const handleDiscardClick = () => {
    if (hasUnsavedChanges) {
      setDiscardOpen(true);
      return;
    }
    router.back();
  };

  const insertSelectedSignature = () => {
    if (selectedSignatureId === "none") return;
    const sig = settings?.signatures.find((s) => s.id === selectedSignatureId)?.content;
    if (sig) setBody((b) => `${b}<p><br/></p>${sig}`);
  };

  const fileToBase64 = (file: File, onProgress?: (progress: number) => void) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onprogress = (event) => {
        if (!event.lengthComputable || !onProgress) return;
        onProgress(Math.round((event.loaded / event.total) * 100));
      };
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1] ?? "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 25 MB limit`,
          variant: "destructive",
        });
        continue;
      }
      const draftKey = `${file.name}-${file.size}-${Date.now()}`;
      setAttachments((prev) => [
        ...prev,
        {
          filename: draftKey,
          contentType: file.type || "application/octet-stream",
          content: "",
          size: file.size,
          previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
          progress: 0,
        },
      ]);
      const content = await fileToBase64(file, (progress) => {
        setAttachments((prev) =>
          prev.map((attachment) =>
            attachment.filename === draftKey ? { ...attachment, progress } : attachment
          )
        );
      });
      setAttachments((prev) =>
        prev.map((attachment) =>
          attachment.filename === draftKey
            ? {
                ...attachment,
                filename: file.name,
                content,
                progress: 100,
              }
            : attachment
        )
      );
    }
  };

  const removeCc = () => {
    setCc([]);
    setShowCc(false);
  };

  const removeBcc = () => {
    setBcc([]);
    setShowBcc(false);
  };

  if (loadingSource && sourceUid) {
    return (
      <MailLayout>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MailLayout>
    );
  }

  const composePanel = (
    <div
      className={cn(
        "flex min-h-0 flex-col bg-background shadow-lg",
        windowMode === "popout" &&
          "fixed bottom-4 right-4 z-50 h-[520px] w-[640px] rounded-lg border",
        windowMode === "maximized" && "h-full min-h-0",
        windowMode === "normal" && "h-full min-h-0",
        windowMode === "minimized" && "h-12 overflow-hidden rounded-lg border"
      )}
    >
      <header className="flex items-center justify-between border-b bg-[#0f6cbd] px-4 py-2 text-white">
        <h1 className="text-sm font-semibold">
          {draftParam ? "Edit draft" : "Compose"}
          {saving && <span className="ml-2 text-xs opacity-80">Saving…</span>}
        </h1>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white hover:bg-white/20"
            onClick={() => setWindowMode((m) => (m === "minimized" ? "popout" : "minimized"))}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white hover:bg-white/20"
            onClick={() =>
              setWindowMode((m) => (m === "maximized" ? "normal" : "maximized"))
            }
          >
            {windowMode === "maximized" ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white hover:bg-white/20"
            onClick={() => {
              if (windowMode === "normal") setWindowMode("popout");
              else router.back();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {windowMode !== "minimized" && (
        <div
          ref={scrollContainerRef}
          onScroll={handleComposeScroll}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6"
        >
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="space-y-2">
              <Label htmlFor="compose-from">From</Label>
              <Input
                id="compose-from"
                value={fromAddress}
                readOnly
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="compose-to">To</Label>
              <RecipientInput
                id="compose-to"
                value={to}
                onChange={setTo}
                placeholder="recipient@example.com"
              />
            </div>

            <div className="flex gap-3 text-sm">
              {!showCc && (
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setShowCc(true)}
                >
                  Add Cc
                </button>
              )}
              {!showBcc && (
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setShowBcc(true)}
                >
                  Add Bcc
                </button>
              )}
            </div>

            {showCc && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="compose-cc">Cc</Label>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={removeCc}
                  >
                    Remove
                  </button>
                </div>
                <RecipientInput
                  id="compose-cc"
                  value={cc}
                  onChange={setCc}
                  placeholder="cc@example.com"
                />
              </div>
            )}

            {showBcc && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="compose-bcc">Bcc</Label>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={removeBcc}
                  >
                    Remove
                  </button>
                </div>
                <RecipientInput
                  id="compose-bcc"
                  value={bcc}
                  onChange={setBcc}
                  placeholder="bcc@example.com"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="compose-subject">Subject</Label>
              <Input
                id="compose-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="(optional)"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Signature</Label>
                <Select value={selectedSignatureId} onValueChange={setSelectedSignatureId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Default signature" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Use default</SelectItem>
                    {settings?.signatures.map((sig) => (
                      <SelectItem key={sig.id} value={sig.id}>
                        {sig.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" size="sm" onClick={insertSelectedSignature}>
                  Insert signature
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={readReceipt}
                    onChange={(e) => setReadReceipt(e.target.checked)}
                  />
                  Request read receipt
                </label>
              </div>
            </div>

            <RichTextEditor
              value={body}
              onChange={setBody}
              mode={editorMode}
              onModeChange={setEditorMode}
              autoFocus
            />

            <div
              className="rounded-lg border border-dashed bg-muted/10 p-4"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFiles(e.dataTransfer.files);
              }}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-md border bg-background p-2">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Attachments</p>
                    <p className="text-xs text-muted-foreground">
                      Drag files here or browse from your device
                    </p>
                  </div>
                </div>
                <Input
                  type="file"
                  multiple
                  className="max-w-xs"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </div>
              {attachments.length > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {attachments.map((a, i) => (
                    <div
                      key={`${a.filename}-${i}`}
                      className="flex items-center gap-3 rounded-md border bg-background px-3 py-2 text-xs"
                    >
                      {a.previewUrl ? (
                        <img
                          src={a.previewUrl}
                          alt={a.filename}
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded border bg-muted/40">
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.filename}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {a.size ? `${Math.max(1, Math.round(a.size / 1024))} KB` : "Attachment"}
                        </p>
                        <div className="mt-1 h-1.5 rounded-full bg-muted">
                          <div
                            className="h-1.5 rounded-full bg-primary transition-all"
                            style={{ width: `${a.progress ?? 100}%` }}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments(attachments.filter((_, idx) => idx !== i))
                        }
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Remove attachment"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSend} disabled={sending || saving}>
                {sending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send
              </Button>
              <Button variant="outline" onClick={() => handleSaveDraft()} disabled={sending || saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Draft
              </Button>
              <Button
                variant="ghost"
                onClick={handleDiscardClick}
                disabled={sending || saving || discarding}
              >
                Discard
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard message?</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Save this message as a draft, discard it, or keep
              composing.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                setDiscardOpen(false);
                await handleSaveDraft();
              }}
              disabled={saving}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save as Draft
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDiscardConfirm()}
              disabled={discarding}
            >
              {discarding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (windowMode === "popout") {
    return (
      <MailLayout>
        <div className="relative h-full min-h-0 overflow-hidden">{composePanel}</div>
      </MailLayout>
    );
  }

  return (
    <MailLayout>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">{composePanel}</div>
    </MailLayout>
  );
}
