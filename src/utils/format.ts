const NA = "N/A";

export function toSafeNumber(
  value: bigint | number | string | null | undefined,
  fallback = 0
): number {
  if (value === null || value === undefined) return fallback;

  if (typeof value === "bigint") {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : fallback;
  }

  return fallback;
}

export function toSafeBigInt(
  value: bigint | number | string | null | undefined,
  fallback: bigint = BigInt(0)
): bigint {
  if (value === null || value === undefined) return fallback;

  if (typeof value === "bigint") return value;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return fallback;
    return BigInt(Math.trunc(value));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    try {
      return BigInt(trimmed);
    } catch {
      return fallback;
    }
  }

  return fallback;
}

export function parseDateValue(
  date: Date | string | number | null | undefined
): Date | null {
  if (date === null || date === undefined) return null;

  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(
  date: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  fallback = NA
): string {
  const d = parseDateValue(date);
  if (!d) return fallback;

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  });
}

export function formatDateTime(
  date: Date | string | number | null | undefined,
  fallback = NA
): string {
  const d = parseDateValue(date);
  if (!d) return fallback;

  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatBytes(
  bytes: bigint | number | string | null | undefined,
  decimals = 2,
  fallback = "0 Bytes"
): string {
  const num = toSafeNumber(bytes, -1);
  if (num < 0) return fallback;
  if (num === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.floor(Math.log(num) / Math.log(k)),
    sizes.length - 1
  );

  if (i < 0 || !Number.isFinite(i)) return "0 Bytes";

  return `${parseFloat((num / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function formatNumber(
  value: number | string | bigint | null | undefined,
  fallback = "0"
): string {
  if (value === null || value === undefined) return fallback;

  const n = toSafeNumber(value, NaN);
  if (Number.isNaN(n)) return fallback;

  return n.toLocaleString("en-US");
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency = "INR",
  locale = "en-IN",
  fallback = NA
): string {
  const n = toSafeNumber(amount, NaN);
  if (Number.isNaN(n)) return fallback;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(n);
}

export function formatLimit(value: number | null | undefined): string {
  if (value === null || value === undefined) return NA;
  if (value === -1) return "∞";
  return formatNumber(value);
}
