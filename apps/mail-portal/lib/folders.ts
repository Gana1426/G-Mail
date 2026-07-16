import path from "path";
import type { MailFolderId } from "@mail-portal/types/mail";
import { splitMaildirFilename } from "@mail-portal/lib/maildir-filename";

const FOLDER_MAP: Record<
  MailFolderId,
  { label: string; maildirSubfolder: string | null; virtual?: boolean }
> = {
  INBOX: { label: "Inbox", maildirSubfolder: null },
  SENT: { label: "Sent", maildirSubfolder: ".Sent" },
  DRAFTS: { label: "Drafts", maildirSubfolder: ".Drafts" },
  SPAM: { label: "Spam", maildirSubfolder: ".Junk" },
  TRASH: { label: "Trash", maildirSubfolder: ".Trash" },
  ARCHIVE: { label: "Archive", maildirSubfolder: ".Archive" },
  STARRED: { label: "Starred", maildirSubfolder: null, virtual: true },
  IMPORTANT: { label: "Important", maildirSubfolder: null, virtual: true },
  OUTBOX: { label: "Outbox", maildirSubfolder: ".Outbox" },
};

export function getFolderLabel(folder: MailFolderId): string {
  return FOLDER_MAP[folder]?.label ?? folder;
}

export function isVirtualFolder(folder: MailFolderId): boolean {
  return !!FOLDER_MAP[folder]?.virtual;
}

export function resolveMaildirFolderPath(
  maildirPath: string,
  folder: MailFolderId
): string {
  const sub = FOLDER_MAP[folder]?.maildirSubfolder;
  if (!sub) return maildirPath;
  return path.join(maildirPath, sub);
}

export function parseMaildirFlags(filename: string): {
  isRead: boolean;
  isStarred: boolean;
  isImportant: boolean;
} {
  const { flagString } = splitMaildirFilename(filename);
  return {
    isRead: flagString.includes("S"),
    isStarred: flagString.includes("F"),
    isImportant: flagString.includes("$") || flagString.includes("!"),
  };
}

export function buildMaildirFlags(flags: {
  isRead?: boolean;
  isStarred?: boolean;
  isImportant?: boolean;
}): string {
  let f = "";
  if (flags.isRead) f += "S";
  if (flags.isStarred) f += "F";
  if (flags.isImportant) f += "$";
  return f;
}

export function listPhysicalFolders(): MailFolderId[] {
  return (Object.keys(FOLDER_MAP) as MailFolderId[]).filter(
    (f) => !FOLDER_MAP[f].virtual
  );
}

export function listSidebarFolders(): MailFolderId[] {
  return [
    "INBOX",
    "SENT",
    "DRAFTS",
    "ARCHIVE",
    "SPAM",
    "TRASH",
    "STARRED",
    "IMPORTANT",
    "OUTBOX",
  ];
}
