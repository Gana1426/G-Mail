import type { MailAddress } from "@mail-portal/types/mail";

export function parseAddressList(input: string): MailAddress[] {
  return input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(parseSingleAddress);
}

export function parseSingleAddress(input: string): MailAddress {
  const match = input.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].replace(/^"|"$/g, "").trim(), address: match[2].trim() };
  }
  return { address: input.trim() };
}

export function formatAddress(addr: MailAddress): string {
  if (addr.name) return `${addr.name} <${addr.address}>`;
  return addr.address;
}

export function formatAddressList(addrs: MailAddress[]): string {
  return addrs.map(formatAddress).join(", ");
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(text: string, max = 280): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
