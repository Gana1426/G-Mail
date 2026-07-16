import winston from "winston";
import path from "path";

const logDir = path.join(process.cwd(), "logs");

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? ` ${JSON.stringify(meta)}`
      : "";
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: logFormat,
  defaultMeta: { service: "mailhost-platform" },
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
});

if (!process.env.VERCEL) {
  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      maxsize: 10485760,
      maxFiles: 5,
    })
  );
  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, "combined.log"),
      maxsize: 10485760,
      maxFiles: 10,
    })
  );
}

export function logAudit(
  action: string,
  userId: string | null,
  resource: string,
  details?: Record<string, unknown>
): void {
  logger.info("Audit", {
    action,
    userId,
    resource,
    ...details,
  });
}

export function logAuth(
  action: string,
  email: string,
  success: boolean,
  ip?: string
): void {
  logger.info("Auth", {
    action,
    email,
    success,
    ip,
  });
}
