import fs from "fs/promises";
import path from "path";
import type { MailSessionContext } from "@mail-portal/types/mail";
import { mailProvisionService } from "@/services/mail-provision.service";

const ROOT_SUBDIRS = ["cur", "new", "tmp"] as const;
const SPECIAL_FOLDERS = [
  ".Sent",
  ".Drafts",
  ".Trash",
  ".Junk",
  ".Spam",
  ".Archive",
  ".Outbox",
] as const;

export function resolveSessionMaildirPath(session: MailSessionContext): string {
  const stored = session.maildirPath;
  if (
    stored.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(stored)
  ) {
    return path.normalize(stored);
  }
  const [localPart, domain] = session.email.split("@");
  return mailProvisionService.getMaildirPath(domain, localPart);
}

export async function ensureMaildirStructure(maildirPath: string): Promise<void> {
  for (const sub of ROOT_SUBDIRS) {
    await fs.mkdir(path.join(maildirPath, sub), { recursive: true });
  }
  for (const folder of SPECIAL_FOLDERS) {
    for (const sub of ROOT_SUBDIRS) {
      await fs.mkdir(path.join(maildirPath, folder, sub), { recursive: true });
    }
  }
}
