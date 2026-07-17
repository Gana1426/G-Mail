/**
 * Client-safe config only. Never put secrets here.
 * Prefer NEXT_PUBLIC_* env vars for values shown in the browser.
 */
export const publicConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? process.env.APP_NAME ?? "MailHost Platform",
  mailHostname:
    process.env.NEXT_PUBLIC_MAIL_HOSTNAME ??
    process.env.MAIL_HOSTNAME ??
    "mail.example.com",
  smtpPort: parseInt(
    process.env.NEXT_PUBLIC_MAIL_SMTP_PORT ?? process.env.MAIL_SMTP_PORT ?? "587",
    10
  ),
  imapPort: parseInt(
    process.env.NEXT_PUBLIC_MAIL_IMAP_PORT ?? process.env.MAIL_IMAP_PORT ?? "993",
    10
  ),
  pop3Port: parseInt(
    process.env.NEXT_PUBLIC_MAIL_POP3_PORT ?? process.env.MAIL_POP3_PORT ?? "995",
    10
  ),
  webmailUrl:
    process.env.NEXT_PUBLIC_WEBMAIL_URL ??
    process.env.ROUNDCUBE_URL ??
    "http://localhost:8080",
} as const;
