export const MAIL_SESSION_COOKIE = "mail_session";
export const MAIL_SESSION_EXPIRY_HOURS = 12;
export const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export const SYSTEM_FOLDERS = [
  "INBOX",
  "SENT",
  "DRAFTS",
  "SPAM",
  "TRASH",
  "ARCHIVE",
  "STARRED",
  "IMPORTANT",
  "OUTBOX",
] as const;
