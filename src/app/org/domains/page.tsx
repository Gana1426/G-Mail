"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { DashboardLayout } from "@/components/layout/sidebar";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PlanLimitBanner, PlanUsageCard } from "@/components/org/plan-usage-card";
import { UpgradePlanDialog } from "@/components/org/upgrade-plan-dialog";
import { invalidatePlanUsage, usePlanUsage } from "@/hooks/use-plan-usage";
import { api, isPlanLimitError } from "@/services/api.client";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/utils";
import {
  Plus,
  MoreHorizontal,
  Star,
  RefreshCw,
  Trash2,
  ShieldOff,
  Eye,
  ArrowUpCircle,
} from "lucide-react";

interface DomainRow {
  id: string;
  name: string;
  status: string;
  isDefault: boolean;
  verifiedAt: string | null;
  lastVerifiedAt: string | null;
  createdAt: string;
  _count?: { mailboxes: number };
}

function statusVariant(status: string) {
  switch (status) {
    case "VERIFIED":
      return "success" as const;
    case "VERIFYING":
      return "warning" as const;
    case "PENDING":
      return "secondary" as const;
    case "FAILED":
      return "destructive" as const;
    case "SUSPENDED":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "VERIFIED":
      return "Verified";
    case "VERIFYING":
      return "Verifying";
    case "PENDING":
      return "Pending";
    case "FAILED":
      return "Failed";
    case "SUSPENDED":
      return "Suspended";
    default:
      return status;
  }
}

export default function OrgDomainsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: planUsage } = usePlanUsage();
  const [deleteTarget, setDeleteTarget] = useState<DomainRow | null>(null);
  const [deleteReason, setDeleteReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const domainLimitReached = planUsage?.domains.atLimit ?? false;

  const { data, isLoading } = useQuery({
    queryKey: ["org-domains"],
    queryFn: async () => {
      const res = await api.get<DomainRow[]>("/domains?limit=100");
      return res.data ?? [];
    },
  });

  const handleAction = async (
    action: string,
    domain: DomainRow
  ) => {
    setLoading(true);
    try {
      switch (action) {
        case "verify":
          router.push(`/org/domains/${domain.id}`);
          break;
        case "set-default":
          await api.post(`/domains/${domain.id}/set-default`);
          toast({ title: "Default domain updated" });
          break;
        case "regenerate": {
          const res = await api.post<{ message?: string }>(
            `/domains/${domain.id}/regenerate-dns`
          );
          toast({
            title: "Success",
            description:
              res.message ?? "DNS Records regenerated successfully.",
          });
          await queryClient.invalidateQueries({ queryKey: ["domain-verify", domain.id] });
          router.push(`/org/domains/${domain.id}`);
          break;
        }
        case "suspend":
          await api.post(`/domains/${domain.id}/suspend`);
          toast({ title: "Domain suspended" });
          break;
        case "delete-check":
          const check = await api.get<{
            canDelete: boolean;
            reason: string | null;
          }>(`/domains/${domain.id}/delete-check`);
          if (!check.data?.canDelete) {
            toast({
              title: "Cannot delete domain",
              description: check.data?.reason ?? "Domain has mailboxes",
              variant: "destructive",
            });
            return;
          }
          setDeleteReason(check.data?.reason);
          setDeleteTarget(domain);
          break;
        case "delete":
          if (!deleteTarget) return;
          await api.delete(`/domains/${deleteTarget.id}`);
          toast({ title: "Domain deleted" });
          setDeleteTarget(null);
          break;
      }
      await queryClient.invalidateQueries({ queryKey: ["org-domains"] });
      await queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
      await invalidatePlanUsage(queryClient);
    } catch (error) {
      if (isPlanLimitError(error)) {
        setShowUpgrade(true);
      }
      toast({
        title: "Action failed",
        description: error instanceof Error ? error.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnDef<DomainRow>[] = [
    {
      accessorKey: "name",
      header: "Domain Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.original.name}</span>
          {row.original.isDefault && (
            <Badge variant="outline" className="gap-1">
              <Star className="h-3 w-3" />
              Default
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.original.status)}>
          {statusLabel(row.original.status)}
        </Badge>
      ),
    },
    {
      id: "verification",
      header: "Verification",
      cell: ({ row }) =>
        row.original.status === "VERIFIED" ? (
          <Badge variant="success">Verified</Badge>
        ) : (
          <Badge variant="warning">Pending</Badge>
        ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      id: "lastVerified",
      header: "Last Verified",
      cell: ({ row }) =>
        row.original.lastVerifiedAt || row.original.verifiedAt
          ? formatDateTime(
              row.original.lastVerifiedAt ?? row.original.verifiedAt!
            )
          : "—",
    },
    {
      id: "mailboxes",
      header: "Mailboxes",
      cell: ({ row }) => row.original._count?.mailboxes ?? 0,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const domain = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/org/domains/${domain.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </Link>
              </DropdownMenuItem>
              {domain.status !== "VERIFIED" && (
                <DropdownMenuItem onClick={() => handleAction("verify", domain)}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Verify Again
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => handleAction("regenerate", domain)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Generate DNS Again
              </DropdownMenuItem>
              {domain.status === "VERIFIED" && !domain.isDefault && (
                <DropdownMenuItem onClick={() => handleAction("set-default", domain)}>
                  <Star className="mr-2 h-4 w-4" />
                  Set Default
                </DropdownMenuItem>
              )}
              {domain.status === "VERIFIED" && (
                <DropdownMenuItem onClick={() => handleAction("suspend", domain)}>
                  <ShieldOff className="mr-2 h-4 w-4" />
                  Suspend
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => handleAction("delete-check", domain)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <DashboardLayout
      variant="org"
      title="Domains"
      breadcrumbs={[{ label: "Organization" }, { label: "Domains" }]}
    >
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {domainLimitReached && planUsage && (
            <PlanLimitBanner
              message={planUsage.limitMessages.domain}
              onUpgrade={() => setShowUpgrade(true)}
            />
          )}
        </div>
        <PlanUsageCard compact />
      </div>

      <div className="mb-6 flex items-center justify-between">
        <p className="text-muted-foreground">
          Manage multiple domains for your organization
        </p>
        <div className="flex gap-2">
          {domainLimitReached && (
            <Button variant="outline" onClick={() => setShowUpgrade(true)}>
              <ArrowUpCircle className="mr-2 h-4 w-4" />
              Upgrade Plan
            </Button>
          )}
          {domainLimitReached ? (
            <Button disabled>
              <Plus className="mr-2 h-4 w-4" />
              Add Domain
            </Button>
          ) : (
            <Button asChild>
              <Link href="/org/domains/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Domain
              </Link>
            </Button>
          )}
        </div>
      </div>

      <DataTable columns={columns} data={data ?? []} loading={isLoading} />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete domain?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <strong>{deleteTarget?.name}</strong>. This action cannot be
              undone.
              {deleteReason && (
                <span className="mt-2 block text-destructive">
                  {deleteReason}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => handleAction("delete", deleteTarget!)}
            >
              Delete Domain
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpgradePlanDialog open={showUpgrade} onOpenChange={setShowUpgrade} />
    </DashboardLayout>
  );
}
