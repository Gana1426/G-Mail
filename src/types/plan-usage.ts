export const PLAN_LIMIT_MESSAGES = {
  domain: "Domain limit reached. Upgrade your plan to add more domains.",
  mailbox:
    "Mailbox limit reached. Upgrade your plan to create more mailboxes.",
  mailboxPerDomain:
    "Mailbox limit reached for this domain. Upgrade your plan to create more mailboxes.",
  alias:
    "Aliases are not available on your current plan. Upgrade to enable aliases.",
  forwarder:
    "Forwarders are not available on your current plan. Upgrade to enable forwarders.",
} as const;

export interface ResourceUsage {
  used: number;
  limit: number;
  atLimit: boolean;
  remaining: number | null;
  percent: number;
}

export interface PlanUsageSummary {
  plan: {
    id: string;
    name: string;
    tier: string;
    code: string;
    maxDomains: number;
    maxMailboxes: number;
    maxMailboxesPerDomain: number | null;
    storageQuotaBytes: string;
    aliasesEnabled: boolean;
    forwardersEnabled: boolean;
  };
  domains: ResourceUsage;
  mailboxes: ResourceUsage;
  storage: {
    used: string;
    limit: string;
    percent: number;
    atLimit: boolean;
  };
  aliasesEnabled: boolean;
  forwardersEnabled: boolean;
  canCreateDomain: boolean;
  canCreateMailbox: boolean;
  limitMessages: typeof PLAN_LIMIT_MESSAGES;
}
