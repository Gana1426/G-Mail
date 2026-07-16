export const config = {
  app: {
    name: process.env.APP_NAME ?? "MailHost Platform",
    url: process.env.APP_URL ?? "http://localhost:3000",
    env: process.env.NODE_ENV ?? "development",
  },
  database: {
    url: process.env.DATABASE_URL!,
  },
  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY ?? "15m",
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? "7d",
  },
  mail: {
    hostname: process.env.MAIL_HOSTNAME ?? "mail.example.com",
    serverIp:
      process.env.SERVER_IP ??
      process.env.MAIL_SERVER_IP ??
      "127.0.0.1",
    smtpPort: parseInt(process.env.MAIL_SMTP_PORT ?? "587", 10),
    imapPort: parseInt(process.env.MAIL_IMAP_PORT ?? "993", 10),
    pop3Port: parseInt(process.env.MAIL_POP3_PORT ?? "995", 10),
    domain: process.env.MAIL_DOMAIN ?? "example.com",
    dataPath: process.env.MAIL_DATA_PATH ?? "",
    // Local dev: maildir-only by default. Set MAIL_SMTP_ENABLED=true when Postfix is running.
    smtpEnabled:
      process.env.MAIL_SMTP_ENABLED === "true" ||
      (process.env.NODE_ENV === "production" &&
        process.env.MAIL_SMTP_ENABLED !== "false"),
    imapEnabled:
      process.env.MAIL_IMAP_ENABLED === "true" ||
      (process.env.NODE_ENV === "production" &&
        process.env.MAIL_IMAP_ENABLED !== "false"),
  },
  roundcube: {
    url: process.env.ROUNDCUBE_URL ?? "http://localhost:8080",
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY!,
  },
  email: {
    user: process.env.EMAIL_USER ?? "",
    pass: process.env.EMAIL_PASS ?? "",
    admin: process.env.ADMIN_EMAIL ?? process.env.EMAIL_USER ?? "",
    host: process.env.EMAIL_HOST ?? "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT ?? "587", 10),
  },
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
} as const;

function validateConfig(): void {
  const required = [
    { key: "DATABASE_URL", value: process.env.DATABASE_URL },
    { key: "JWT_SECRET", value: process.env.JWT_SECRET },
    { key: "ENCRYPTION_KEY", value: process.env.ENCRYPTION_KEY },
  ];

  const missing = required.filter((r) => !r.value).map((r) => r.key);
  if (missing.length > 0 && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

validateConfig();
