import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { config } from "@/config";
import { logAuth } from "@/utils/logger";

const execAsync = promisify(exec);

/**
 * Mail storage architecture:
 *
 * INCOMING: Internet → Postfix → Dovecot LMTP → Maildir on disk
 * OUTGOING: Mailbox → SMTP auth → Postfix → Internet
 *
 * PostgreSQL stores mailbox metadata (quota, status, config).
 * Email bodies live ONLY in Maildir — never in the database.
 *
 * Default path: /home/vmail/{domain}/{localPart}/
 */
export class MailProvisionService {
  /**
   * Filesystem provisioning only works where the app has a writable disk
   * (local dev, VPS). Serverless hosts like Vercel have a read-only
   * filesystem, so we skip fs writes there and keep mailbox metadata in
   * the database only. Override with MAIL_FS_PROVISION_ENABLED=true/false.
   */
  private isFsProvisionEnabled(): boolean {
    if (process.env.MAIL_FS_PROVISION_ENABLED === "false") return false;
    if (process.env.MAIL_FS_PROVISION_ENABLED === "true") return true;
    return !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME;
  }

  private getMailBasePath(): string {
    if (process.env.MAIL_DATA_PATH) {
      return process.env.MAIL_DATA_PATH;
    }
    return config.app.env === "production"
      ? "/home/vmail"
      : path.join(process.cwd(), "data", "mail", "vmail");
  }

  getMaildirPath(domain: string, localPart: string): string {
    return path.join(
      this.getMailBasePath(),
      domain.toLowerCase(),
      localPart.toLowerCase()
    );
  }

  async provisionMailbox(params: {
    domain: string;
    localPart: string;
    email: string;
    passwordHash: string;
    quotaBytes?: bigint;
  }): Promise<string> {
    const maildirPath = this.getMaildirPath(params.domain, params.localPart);

    if (!this.isFsProvisionEnabled()) {
      logAuth("mail_provision_fs_skipped", params.email, true);
      return maildirPath;
    }

    try {
      await this.createMaildir(maildirPath);
      await this.writeDovecotAuthEntry(
        params.email,
        maildirPath,
        params.passwordHash
      );
      await this.writePostfixMailboxEntry(params.email, maildirPath);
      await this.reloadMailServices();
    } catch (error) {
      // Read-only or restricted filesystem: keep DB as source of truth and
      // let the mail server sync provisioning separately.
      console.error(
        `[MailProvision] Filesystem provisioning failed for ${params.email}:`,
        error instanceof Error ? error.message : error
      );
      logAuth("mail_provision_fs_failed", params.email, false);
    }

    return maildirPath;
  }

  async deprovisionMailbox(maildirPath: string | null, email?: string): Promise<void> {
    if (!this.isFsProvisionEnabled()) return;

    if (maildirPath) {
      await fs.rm(maildirPath, { recursive: true, force: true }).catch(() => {});
      const domainDir = path.dirname(maildirPath);
      const entries = await fs.readdir(domainDir).catch(() => []);
      if (entries.length === 0) {
        await fs.rmdir(domainDir).catch(() => {});
      }
    }
    if (email) {
      await this.removeDovecotAuthEntry(email);
      await this.removePostfixMailboxEntry(email);
    }
    await this.reloadMailServices();
  }

  async updateMailboxPassword(email: string, passwordHash: string, maildirPath: string): Promise<void> {
    if (!this.isFsProvisionEnabled()) return;

    try {
      await this.writeDovecotAuthEntry(email, maildirPath, passwordHash);
      await this.reloadMailServices();
      logAuth("mail_provision_password", email, true);
    } catch (error) {
      console.error(
        `[MailProvision] Password sync failed for ${email}:`,
        error instanceof Error ? error.message : error
      );
      logAuth("mail_provision_password", email, false);
    }
  }

  private async createMaildir(maildirPath: string): Promise<void> {
    const folders = ["cur", "new", "tmp"];
    const subfolders = [".Drafts", ".Sent", ".Trash", ".Junk", ".Spam", ".Archive", ".Outbox"];
    for (const f of folders) {
      await fs.mkdir(path.join(maildirPath, f), { recursive: true });
    }
    for (const sub of subfolders) {
      for (const f of folders) {
        await fs.mkdir(path.join(maildirPath, sub, f), { recursive: true });
      }
    }
  }

  private getDovecotPasswdPath(): string {
    return (
      process.env.DOVECOT_PASSWD_PATH ??
      path.join(process.cwd(), "data", "mail", "dovecot", "passwd")
    );
  }

  private getPostfixVirtualPath(): string {
    return (
      process.env.POSTFIX_VIRTUAL_PATH ??
      path.join(process.cwd(), "data", "mail", "postfix", "virtual_mailboxes")
    );
  }

  private async writeDovecotAuthEntry(
    email: string,
    maildirPath: string,
    passwordHash: string
  ): Promise<void> {
    const passwdPath = this.getDovecotPasswdPath();
    await fs.mkdir(path.dirname(passwdPath), { recursive: true });

    let content = "";
    try {
      content = await fs.readFile(passwdPath, "utf-8");
    } catch {
      content = "";
    }

    const lines = content
      .split("\n")
      .filter((line) => line && !line.startsWith(`${email}:`));

    // Dovecot passwd-file: user:{SCHEME}hash:uid:gid:gecos:home:mail
    lines.push(
      `${email}:{BLF-CRYPT}${passwordHash}:5000:5000::${maildirPath}::`
    );
    await fs.writeFile(passwdPath, lines.join("\n") + "\n", "utf-8");
  }

  private async writePostfixMailboxEntry(email: string, maildirPath: string): Promise<void> {
    const virtualPath = this.getPostfixVirtualPath();
    await fs.mkdir(path.dirname(virtualPath), { recursive: true });

    let content = "";
    try {
      content = await fs.readFile(virtualPath, "utf-8");
    } catch {
      content = "";
    }

    const lines = content
      .split("\n")
      .filter((line) => line && !line.startsWith(`${email} `));

    lines.push(`${email} ${maildirPath}/`);
    await fs.writeFile(virtualPath, lines.join("\n") + "\n", "utf-8");
  }

  private async removeDovecotAuthEntry(email: string): Promise<void> {
    const passwdPath = this.getDovecotPasswdPath();
    try {
      const content = await fs.readFile(passwdPath, "utf-8");
      const lines = content
        .split("\n")
        .filter((line) => line && !line.startsWith(`${email}:`));
      await fs.writeFile(passwdPath, lines.join("\n") + "\n", "utf-8");
    } catch {
      // file may not exist
    }
  }

  private async removePostfixMailboxEntry(email: string): Promise<void> {
    const virtualPath = this.getPostfixVirtualPath();
    try {
      const content = await fs.readFile(virtualPath, "utf-8");
      const lines = content
        .split("\n")
        .filter((line) => line && !line.startsWith(`${email} `));
      await fs.writeFile(virtualPath, lines.join("\n") + "\n", "utf-8");
    } catch {
      // file may not exist
    }
  }

  private async reloadMailServices(): Promise<void> {
    if (process.env.MAIL_RELOAD_ENABLED !== "true") return;

    const postfixContainer = process.env.POSTFIX_CONTAINER ?? "mailhost-postfix-1";
    const dovecotContainer = process.env.DOVECOT_CONTAINER ?? "mailhost-dovecot-1";

    await execAsync(`docker exec ${postfixContainer} postfix reload`).catch(() => {});
    await execAsync(`docker exec ${dovecotContainer} doveadm reload`).catch(() => {});
  }
}

export const mailProvisionService = new MailProvisionService();
