"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RecipientInputProps {
  value: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export function RecipientInput({
  value,
  onChange,
  placeholder = "Add recipients…",
  className,
  id,
}: RecipientInputProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const addEmails = (raw: string) => {
    const parts = raw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!parts.length) return;

    const next = [...value];
    for (const part of parts) {
      if (!EMAIL_RE.test(part)) {
        setError(`Invalid email address: ${part}`);
        return;
      }
      if (!next.includes(part)) next.push(part);
    }
    onChange(next);
    setInput("");
    setError("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      if (input.trim()) addEmails(input);
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeEmail = (email: string) => {
    onChange(value.filter((e) => e !== email));
  };

  return (
    <div className={className}>
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
        )}
      >
        {value.map((email) => (
          <span
            key={email}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-sm"
          >
            {email}
            <button
              type="button"
              className="rounded hover:bg-muted-foreground/20"
              onClick={() => removeEmail(email)}
              aria-label={`Remove ${email}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError("");
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (input.trim()) addEmails(input);
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-[140px] flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function parseRecipientList(value: string): string[] {
  return value
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function validateRecipientList(emails: string[]): string | null {
  for (const email of emails) {
    if (!EMAIL_RE.test(email)) {
      return `Invalid email address: ${email}`;
    }
  }
  return null;
}
