"use client";

import { use, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/sidebar";
import { api } from "@/services/api.client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DnsRecordsTable } from "@/components/domains/dns-records-table";
import { useToast } from "@/hooks/use-toast";
import type { DnsRecordItem } from "@/types";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface DomainDetailData {
  domain: {
    id: string;
    name: string;
    status: string;
    verifiedAt: string | null;
    dnsGeneratedAt?: string | null;
  };
  dnsRecords: DnsRecordItem[];
  progress: { verified: number; total: number };
  lastVerificationAt: string | null;
}

interface VerifyResult extends DomainDetailData {
  verified: boolean;
  message: string;
}

export default function DomainDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [verifying, setVerifying] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["domain-verify", id],
    queryFn: async () => {
      const res = await api.get<DomainDetailData>(`/domains/${id}/verify`);
      return res.data!;
    },
    retry: 2,
  });

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await api.post<VerifyResult>(`/domains/${id}/verify`);
      const result = res.data!;

      await queryClient.invalidateQueries({ queryKey: ["domain-verify", id] });
      await queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
      await queryClient.invalidateQueries({ queryKey: ["org-domains"] });
      await queryClient.invalidateQueries({ queryKey: ["org-dashboard"] });

      if (result.verified) {
        toast({
          title: "Domain verified",
          description: "All DNS records are configured correctly",
        });
      } else {
        toast({
          title: "Verification incomplete",
          description: `${result.progress.verified} of ${result.progress.total} records verified`,
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Verification failed",
        description:
          err instanceof Error ? err.message : "Could not verify domain",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleRegenerateDns = async () => {
    setRegenerating(true);
    try {
      const res = await api.post<{ message?: string }>(
        `/domains/${id}/regenerate-dns`
      );
      await queryClient.invalidateQueries({ queryKey: ["domain-verify", id] });
      await queryClient.invalidateQueries({ queryKey: ["org-domains"] });
      await queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
      toast({
        title: "Success",
        description: res.message ?? "DNS Records regenerated successfully.",
      });
    } catch (err) {
      toast({
        title: "Regeneration failed",
        description: err instanceof Error ? err.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setRegenerating(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout variant="org" title="DNS Records">
        <div className="space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (isError || !data) {
    return (
      <DashboardLayout variant="org" title="DNS Records">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-muted-foreground">
              {error instanceof Error
                ? error.message
                : "Failed to load DNS records"}
            </p>
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const { domain, dnsRecords, progress } = data;
  const isVerified = domain.status === "VERIFIED";

  return (
    <DashboardLayout
      variant="org"
      title={domain.name}
      breadcrumbs={[
        { label: "Domains", href: "/org/domains" },
        { label: domain.name },
      ]}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">{domain.name}</h2>
              {isVerified ? (
                <Badge className="bg-green-600 hover:bg-green-600">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="secondary">Pending Verification</Badge>
              )}
            </div>
            {domain.verifiedAt && (
              <p className="text-muted-foreground mt-1 text-sm">
                Verified on{" "}
                {format(new Date(domain.verifiedAt), "MMMM d, yyyy 'at' h:mm a")}
              </p>
            )}
            {domain.dnsGeneratedAt && (
              <p className="text-muted-foreground mt-1 text-sm">
                DNS generated{" "}
                {format(
                  new Date(domain.dnsGeneratedAt),
                  "MMMM d, yyyy 'at' h:mm a"
                )}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh Status
            </Button>
            <Button
              variant="outline"
              onClick={handleRegenerateDns}
              disabled={regenerating || isFetching}
            >
              {regenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Generate DNS Again
            </Button>
          </div>
        </div>

        {isVerified && (
          <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20">
            <CardContent className="flex items-center gap-3 py-4">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">
                  Domain verified successfully
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  All {progress.total} DNS records are configured. Mail hosting
                  features are now unlocked.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>DNS Records & Verification</CardTitle>
            <CardDescription>
              Add these records at your domain registrar or DNS provider. Each
              row shows live verification status. Changes may take up to 48 hours
              to propagate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DnsRecordsTable
              records={dnsRecords}
              domainName={domain.name}
              showStatus
              progress={progress}
              onVerify={!isVerified ? handleVerify : undefined}
              verifying={verifying}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
