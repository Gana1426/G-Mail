import { UserRole } from "@prisma/client";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  organizationId?: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organizationId: string | null;
  avatar: string | null;
  twoFactorEnabled: boolean;
  emailVerified: boolean;
}

export interface DashboardStats {
  totalOrganizations: number;
  totalDomains: number;
  totalMailboxes: number;
  totalStorage: bigint;
  usedStorage: bigint;
  mailQueue: {
    incoming: number;
    outgoing: number;
    deferred: number;
    failed: number;
  };
  spamQueue: number;
  systemMetrics: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
  };
}

export interface DnsCheckResult {
  mx: DnsRecordCheck;
  a: DnsRecordCheck;
  spf: DnsRecordCheck;
  dkim: DnsRecordCheck;
  dmarc: DnsRecordCheck;
  autodiscover: DnsRecordCheck;
  autoconfig: DnsRecordCheck;
}

export interface DnsRecordItem {
  type: "MX" | "A" | "TXT" | "CNAME";
  host: string;
  value: string;
  priority?: number;
  ttl: number;
  status: "VALID" | "INVALID" | "PENDING" | "MISSING";
}

export interface DnsRecordCheck {
  status: "VALID" | "INVALID" | "PENDING" | "MISSING";
  expected: string;
  actual: string | null;
  message: string;
}

export interface DkimKeyPair {
  selector: string;
  privateKey: string;
  publicKey: string;
  dnsRecord: string;
}

export interface SpfRecord {
  record: string;
  mechanisms: string[];
}

export interface DmarcRecord {
  record: string;
  policy: "none" | "quarantine" | "reject";
  percentage: number;
  rua: string;
  ruf: string;
}

export interface MailServerSettings {
  smtp: {
    hostname: string;
    port: number;
    tls: boolean;
    ssl: boolean;
    auth: boolean;
    maxConnections: number;
    maxMessageSize: number;
  };
  imap: {
    port: number;
    ssl: boolean;
    tls: boolean;
  };
  pop3: {
    port: number;
    ssl: boolean;
    tls: boolean;
  };
}

export interface WebmailSsoToken {
  token: string;
  expiresAt: Date;
  roundcubeUrl: string;
}

export type RolePermissions = {
  [key in UserRole]: string[];
};

export const ROLE_PERMISSIONS: RolePermissions = {
  SUPER_ADMIN: [
    "organizations:*",
    "domains:*",
    "mailboxes:*",
    "aliases:*",
    "forwarders:*",
    "spam:*",
    "queue:*",
    "storage:*",
    "logs:*",
    "settings:*",
    "users:*",
    "dashboard:*",
  ],
  ORG_ADMIN: [
    "organizations:read",
    "organizations:update",
    "domains:*",
    "mailboxes:*",
    "aliases:*",
    "forwarders:*",
    "spam:read",
    "storage:read",
    "logs:read",
    "dashboard:read",
    "users:read",
    "users:create",
    "users:update",
  ],
  MAIL_USER: [
    "profile:*",
    "mailboxes:read",
    "aliases:read",
    "forwarders:read",
    "forwarders:create",
    "forwarders:update",
    "forwarders:delete",
    "vacation:*",
    "webmail:*",
    "dashboard:read",
  ],
};
