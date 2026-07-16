/**
 * Recursively converts values to JSON-safe types.
 * BigInt → string, Date → ISO string, nested objects/arrays handled.
 */
export function serializeForJson<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "bigint") {
    return String(value) as T;
  }

  if (value instanceof Date) {
    return value.toISOString() as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeForJson(item)) as T;
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = serializeForJson(val);
    }
    return result as T;
  }

  return value;
}

export function serializeMailbox<T extends Record<string, unknown>>(mailbox: T) {
  return serializeForJson({
    ...mailbox,
    quotaBytes:
      mailbox.quotaBytes != null ? String(mailbox.quotaBytes) : undefined,
    usedBytes:
      mailbox.usedBytes != null ? String(mailbox.usedBytes) : undefined,
  });
}

export function serializeMailboxes<T extends Record<string, unknown>>(
  mailboxes: T[]
) {
  return mailboxes.map(serializeMailbox);
}

export function serializeDomain<T extends Record<string, unknown>>(domain: T) {
  return serializeForJson(domain);
}

export function serializeOrganization<T extends Record<string, unknown>>(
  org: T
) {
  return serializeForJson({
    ...org,
    storageQuota:
      org.storageQuota != null ? String(org.storageQuota) : undefined,
    storageUsed:
      org.storageUsed != null ? String(org.storageUsed) : undefined,
  });
}

export function serializeOrganizations<T extends Record<string, unknown>>(
  organizations: T[]
) {
  return organizations.map(serializeOrganization);
}

export function serializePlan<T extends Record<string, unknown>>(plan: T) {
  return serializeForJson({
    ...plan,
    storageQuotaBytes:
      plan.storageQuotaBytes != null
        ? String(plan.storageQuotaBytes)
        : undefined,
  });
}

export function serializePlans<T extends Record<string, unknown>>(plans: T[]) {
  return plans.map(serializePlan);
}
