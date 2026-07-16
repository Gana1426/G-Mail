"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { mailApi } from "@mail-portal/services/api.client";
import { MailAvatar } from "@mail-portal/components/mail/mail-avatar";
import { getFolderLabel } from "@mail-portal/lib/folders";
import { messageDeepLink } from "@mail-portal/lib/folder-routes";
import { formatMailListDate } from "@mail-portal/lib/format-mail-date";
import type { MailMessageSummary } from "@mail-portal/types/mail";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@/utils";

const DEBOUNCE_MS = 300;

export function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<MailMessageSummary[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: q.trim(),
        limit: "8",
        page: "1",
      });
      const res = await mailApi.get<{ messages: MailMessageSummary[] }>(
        `/search?${params.toString()}`
      );
      setSuggestions(res.data?.messages ?? []);
      setActiveIndex(-1);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (query.trim()) {
        void fetchSuggestions(query);
        setOpen(true);
      } else {
        setSuggestions([]);
        setOpen(false);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, fetchSuggestions]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const openMessage = (message: MailMessageSummary) => {
    setOpen(false);
    setQuery("");
    router.push(messageDeepLink(message.folder, message.uid));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter" && query.trim()) {
        router.push(`/mail-portal/search?q=${encodeURIComponent(query.trim())}`);
        setOpen(false);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0];
      if (target) openMessage(target);
    }
  };

  return (
    <div ref={containerRef} className="relative mx-2 max-w-xl flex-1">
      <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.trim() && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search mail (press /)"
        className="h-8 border-0 bg-white pl-9 pr-8 shadow-sm dark:bg-background"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls="mail-search-suggestions"
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}

      {open && query.trim() && (
        <div
          id="mail-search-suggestions"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[400px] overflow-y-auto rounded-md border bg-popover shadow-lg"
          role="listbox"
        >
          {loading && suggestions.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Searching…
            </p>
          ) : suggestions.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No matches found
            </p>
          ) : (
            suggestions.map((message, index) => {
              const senderName = message.from.name ?? message.from.address;
              return (
                <button
                  key={message.uid}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={cn(
                    "flex w-full gap-3 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/60",
                    index === activeIndex && "bg-muted/60"
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => openMessage(message)}
                >
                  <MailAvatar
                    name={message.from.name}
                    email={message.from.address}
                    size="sm"
                    className="mt-0.5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{senderName}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatMailListDate(message.date)}
                      </span>
                    </div>
                    <p className="truncate text-sm text-foreground/90">
                      {message.subject || "(No subject)"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {getFolderLabel(message.folder)}
                    </p>
                  </div>
                </button>
              );
            })
          )}
          {suggestions.length > 0 && (
            <button
              type="button"
              className="w-full border-t px-3 py-2 text-center text-xs text-primary hover:bg-muted/40"
              onClick={() => {
                router.push(`/mail-portal/search?q=${encodeURIComponent(query.trim())}`);
                setOpen(false);
              }}
            >
              View all results
            </button>
          )}
        </div>
      )}
    </div>
  );
}
