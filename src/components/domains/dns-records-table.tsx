"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, Download, Check, Loader2, X } from "lucide-react";
import type { DnsRecordItem } from "@/types";
import { cn } from "@/utils";

interface DnsRecordsTableProps {
  records: DnsRecordItem[];
  domainName: string;
  showStatus?: boolean;
  onVerify?: () => void;
  verifying?: boolean;
  progress?: { verified: number; total: number };
}

function statusBadge(status: DnsRecordItem["status"]) {
  if (status === "VALID") {
    return (
      <Badge className="bg-green-600 hover:bg-green-600">Verified</Badge>
    );
  }
  if (status === "MISSING" || status === "INVALID") {
    return <Badge variant="destructive">{status === "MISSING" ? "Missing" : "Invalid"}</Badge>;
  }
  return <Badge variant="secondary">Pending</Badge>;
}

function recordLabel(record: DnsRecordItem): string {
  if (record.host.includes("_domainkey")) return "DKIM";
  if (record.host === "_dmarc") return "DMARC";
  if (record.type === "TXT" && record.host === "@") return "SPF";
  if (record.type === "MX") return "MX";
  if (record.type === "A") return "A";
  if (record.host === "autodiscover") return "Autodiscover";
  if (record.host === "autoconfig") return "Autoconfig";
  return record.type;
}

export function DnsRecordsTable({
  records,
  domainName,
  showStatus = true,
  onVerify,
  verifying = false,
  progress,
}: DnsRecordsTableProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  if (!records || records.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        No DNS records generated yet. Try refreshing the page.
      </div>
    );
  }

  const copyText = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(null), 2000);
  };

  const formatRecordLine = (r: DnsRecordItem) => {
    const priority = r.priority != null ? String(r.priority) : "";
    return [r.type, r.host, r.value, String(r.ttl), priority]
      .filter(Boolean)
      .join("\t");
  };

  const copyAll = () => {
    const header = "Type\tHost\tValue\tTTL\tPriority\n";
    const body = records.map(formatRecordLine).join("\n");
    copyText(header + body, "all");
  };

  const downloadTxt = () => {
    const header = "Type\tHost\tValue\tTTL\tPriority\n";
    const body = records.map(formatRecordLine).join("\n");
    const blob = new Blob([header + body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dns-records-${domainName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = () => {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = "Type,Host,Value,TTL,Priority,Status\n";
    const body = records
      .map((r) =>
        [
          r.type,
          r.host,
          r.value,
          String(r.ttl),
          r.priority != null ? String(r.priority) : "",
          r.status ?? "PENDING",
        ]
          .map((v) => escape(String(v)))
          .join(",")
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dns-records-${domainName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyValue = (record: DnsRecordItem) => {
    if (record.type === "MX" && record.priority != null) {
      return `${record.priority} ${record.value}`;
    }
    return record.value;
  };

  return (
    <div className="space-y-4">
      {progress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {progress.verified} of {progress.total} records verified
            </span>
            <span className="text-muted-foreground">
              {Math.round((progress.verified / progress.total) * 100)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{
                width: `${(progress.verified / progress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={copyAll}>
          <Copy className="mr-2 h-4 w-4" />
          Copy All DNS Records
        </Button>
        {onVerify && (
          <Button size="sm" onClick={onVerify} disabled={verifying}>
            {verifying ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Verify DNS
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={downloadTxt}>
          <Download className="mr-2 h-4 w-4" />
          Download TXT
        </Button>
        <Button variant="outline" size="sm" onClick={downloadCsv}>
          <Download className="mr-2 h-4 w-4" />
          Download CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">Host</th>
              <th className="px-4 py-3 text-left font-medium">Value</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {records.map((record, i) => {
              const id = `${record.type}-${record.host}-${i}`;
              const value = copyValue(record);

              return (
                <tr key={id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs">{record.type}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {recordLabel(record)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{record.host}</td>
                  <td className="max-w-md px-4 py-3">
                    <code className="block break-all text-xs">{value}</code>
                  </td>
                  <td className="px-4 py-3">
                    {statusBadge(record.status)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyText(value, id)}
                      title="Copy value"
                    >
                      {copied === id ? (
                        <>
                          <Check className="mr-1 h-3.5 w-3.5 text-green-500" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface VerificationStatusProps {
  checks: {
    key: string;
    label: string;
    status: "VALID" | "INVALID" | "PENDING" | "MISSING";
  }[];
  progress?: { verified: number; total: number };
}

export function VerificationStatusList({
  checks,
  progress,
}: VerificationStatusProps) {
  const pct = progress
    ? Math.round((progress.verified / progress.total) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {progress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {progress.verified} of {progress.total} Records Verified
            </span>
            <span className="text-muted-foreground">{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        {checks.map((check) => (
          <div
            key={check.key}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-4 py-3",
              check.status === "VALID" &&
                "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30",
              check.status !== "VALID" &&
                "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
            )}
          >
            {check.status === "VALID" ? (
              <Check className="h-5 w-5 shrink-0 text-green-600" />
            ) : (
              <X className="h-5 w-5 shrink-0 text-red-600" />
            )}
            <span className="font-medium">{check.label}</span>
            <span className="ml-auto text-sm text-muted-foreground">
              {check.status === "VALID"
                ? "Verified"
                : check.status === "MISSING"
                  ? "Missing"
                  : check.status === "PENDING"
                    ? "Pending"
                    : "Incorrect"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
