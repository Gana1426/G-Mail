import { publicConfig } from "@/config/public";

export async function openWebmail(mailboxId?: string): Promise<void> {
  try {
    const res = await fetch("/api/webmail/sso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(mailboxId ? { mailboxId } : {}),
    });
    const data = await res.json();

    if (res.ok && data.data?.roundcubeUrl) {
      window.open(data.data.roundcubeUrl, "_blank", "noopener,noreferrer");
      return;
    }
  } catch {
    // fall through to direct URL
  }

  const mailUrl =
    process.env.NEXT_PUBLIC_WEBMAIL_URL ??
    publicConfig.webmailUrl ??
    `https://${publicConfig.mailHostname}`;
  window.open(mailUrl, "_blank", "noopener,noreferrer");
}
