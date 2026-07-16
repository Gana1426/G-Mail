"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/sidebar";
import { api } from "@/services/api.client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/utils";
import { Globe, ArrowRight } from "lucide-react";

interface DomainRow {
  id: string;
  name: string;
  status: string;
  dnsGeneratedAt?: string | null;
  verifiedAt?: string | null;
  _count?: { mailboxes: number };
}

export default function OrgDnsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["org-domains"],
    queryFn: async () => {
      const res = await api.get<DomainRow[]>("/domains?limit=100");
      return res.data ?? [];
    },
  });

  return (
    <DashboardLayout variant="org" title="DNS Management">
      <p className="text-muted-foreground mb-6">
        Manage DNS records and verification status for all domains
      </p>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="grid gap-4">
          {data?.map((domain) => (
            <Card key={domain.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">{domain.name}</CardTitle>
                    {domain.dnsGeneratedAt && (
                      <p className="text-xs text-muted-foreground">
                        DNS generated {formatDateTime(domain.dnsGeneratedAt)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      domain.status === "VERIFIED" ? "success" : "warning"
                    }
                  >
                    {domain.status}
                  </Badge>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/org/domains/${domain.id}`}>
                      Manage DNS
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {domain._count?.mailboxes ?? 0} mailbox(es) ·{" "}
                  {domain.verifiedAt
                    ? `Verified ${formatDateTime(domain.verifiedAt)}`
                    : "Pending verification"}
                </p>
              </CardContent>
            </Card>
          ))}
          {data?.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">No domains configured</p>
                <Button asChild>
                  <Link href="/org/domains/new">Add Domain</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
