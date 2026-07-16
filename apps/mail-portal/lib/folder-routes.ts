import type { MailFolderId } from "@mail-portal/types/mail";

const FOLDER_SLUGS: Record<MailFolderId, string> = {
  INBOX: "inbox",
  SENT: "sent",
  DRAFTS: "drafts",
  SPAM: "spam",
  TRASH: "trash",
  ARCHIVE: "archive",
  STARRED: "starred",
  IMPORTANT: "important",
  OUTBOX: "outbox",
};

export function folderToSlug(folder: MailFolderId): string {
  return FOLDER_SLUGS[folder] ?? "inbox";
}

export function messageDeepLink(folder: MailFolderId, uid: string): string {
  const slug = folderToSlug(folder);
  if (folder === "DRAFTS") {
    return `/mail-portal/compose?draft=${encodeURIComponent(uid)}`;
  }
  return `/mail-portal/mail/${slug}?uid=${encodeURIComponent(uid)}`;
}
