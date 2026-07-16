"use client";

import { cn } from "@/utils";
import type { ResourceUsage } from "@/types/plan-usage";

interface PlanUsageBarProps {
  label: string;
  usage: ResourceUsage | { used: number; limit: number; percent?: number };
  valueLabel?: string;
  className?: string;
  showPercent?: boolean;
}

function formatLimit(limit: number) {
  return limit === -1 ? "∞" : String(limit);
}

function resolveUsage(
  usage: PlanUsageBarProps["usage"]
): ResourceUsage & { percent: number } {
  if ("atLimit" in usage) {
    return usage;
  }

  const unlimited = usage.limit === -1;
  const atLimit = !unlimited && usage.used >= usage.limit;
  const remaining = unlimited ? null : Math.max(0, usage.limit - usage.used);
  const percent =
    usage.percent ??
    (unlimited || usage.limit === 0
      ? 0
      : Math.min(100, Math.round((usage.used / usage.limit) * 100)));

  return {
    used: usage.used,
    limit: usage.limit,
    atLimit,
    remaining,
    percent,
  };
}

export function PlanUsageBar({
  label,
  usage,
  valueLabel,
  className,
  showPercent = true,
}: PlanUsageBarProps) {
  const resolved = resolveUsage(usage);
  const displayValue =
    valueLabel ?? `${resolved.used} / ${formatLimit(resolved.limit)} Used`;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span
          className={cn(
            "text-muted-foreground",
            resolved.atLimit && "font-medium text-destructive"
          )}
        >
          {displayValue}
          {showPercent && resolved.limit !== -1 ? ` (${resolved.percent}%)` : ""}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            resolved.atLimit ? "bg-destructive" : "bg-primary"
          )}
          style={{
            width: `${resolved.limit === -1 ? Math.min(resolved.percent, 100) : resolved.percent}%`,
          }}
        />
      </div>
    </div>
  );
}

interface StorageUsageBarProps {
  used: string;
  limit: string;
  percent: number;
  atLimit?: boolean;
  className?: string;
}

export function StorageUsageBar({
  used,
  limit,
  percent,
  atLimit,
  className,
}: StorageUsageBarProps) {
  return (
    <PlanUsageBar
      label="Storage"
      usage={{
        used: percent,
        limit: 100,
        percent,
        atLimit: !!atLimit,
        remaining: null,
      }}
      valueLabel={`${used} / ${limit}`}
      showPercent={false}
      className={className}
    />
  );
}
