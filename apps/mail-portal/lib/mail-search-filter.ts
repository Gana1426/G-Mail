import type { MailMessageSummary } from "@mail-portal/types/mail";

export interface MailMessageSearchFilter {
  q?: string;
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
}

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function includes(haystack: string, needle?: string): boolean {
  if (!needle?.trim()) return true;
  return normalize(haystack).includes(normalize(needle));
}

function formatAddresses(
  addresses: Array<{ name?: string; address: string }>
): string {
  return addresses
    .map((a) => `${a.name ?? ""} ${a.address}`.trim())
    .join(" ");
}

export function messageMatchesSearchFilter(
  summary: MailMessageSummary,
  fullText: string,
  filter?: MailMessageSearchFilter
): boolean {
  if (!filter) return true;

  const fromText = `${summary.from.name ?? ""} ${summary.from.address}`.trim();
  const toText = formatAddresses(summary.to);
  const ccText = formatAddresses(summary.cc ?? []);
  const recipientText = `${toText} ${ccText}`.trim();
  const subjectText = summary.subject ?? "";
  const bodyText = fullText || summary.preview;

  if (!includes(fromText, filter.from)) return false;
  if (!includes(recipientText, filter.to)) return false;
  if (!includes(subjectText, filter.subject)) return false;
  if (!includes(bodyText, filter.body)) return false;

  if (filter.q?.trim()) {
    const haystack = [
      subjectText,
      summary.preview,
      fromText,
      recipientText,
      bodyText,
    ].join(" ");
    if (!includes(haystack, filter.q)) return false;
  }

  return true;
}

/** Build a highlight query from search fields (strips `from:` style prefixes). */
export function buildHighlightQuery(
  filter: MailMessageSearchFilter
): string {
  return [filter.q, filter.from, filter.to, filter.subject, filter.body]
    .filter(Boolean)
    .join(" ");
}
