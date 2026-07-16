"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { DashboardLayout } from "@/components/layout/sidebar";
import { useOnboarding } from "@/hooks/use-onboarding";
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
import { api, getApiErrorMessage, isPlanLimitError } from "@/services/api.client";
import { useToast } from "@/hooks/use-toast";
import {
  formatBytes,
  formatDateTime,
  toSafeBigInt,
} from "@/utils";
import { Plus, MoreHorizontal, Eye, Key, HardDrive, ShieldOff, ShieldCheck, Trash2, Mail, ExternalLink, ArrowUpCircle, RefreshCw } from "lucide-react";
import { openWebmail } from "@/lib/webmail";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PlanLimitBanner, PlanUsageCard } from "@/components/org/plan-usage-card";
import { UpgradePlanDialog } from "@/components/org/upgrade-plan-dialog";
import { invalidatePlanUsage, usePlanUsage } from "@/hooks/use-plan-usage";

interface MailboxRow {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  quotaBytes: string;
  usedBytes: string;
  domain?: { name: string } | null;
  createdAt: string;
}

export default function OrgMailboxesPage() {
  const router = useRouter();
  const {
    data: onboarding,
    isLoading: onboardingLoading,
    isError: onboardingError,
  } = useOnboarding();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: planUsage } = usePlanUsage(!!onboarding?.hasVerifiedDomain);
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<MailboxRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const mailboxLimitReached = planUsage?.mailboxes.atLimit ?? false;
  const canListMailboxes =
    !onboardingLoading && onboarding?.hasVerifiedDomain === true;

  useEffect(() => {
    if (onboarding && !onboarding.hasVerifiedDomain) {
      router.replace("/org");
    }
  }, [onboarding, router]);

  const {
    data,
    isLoading: mailboxesLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["org-mailboxes", page],
    queryFn: () => api.get<MailboxRow[]>(`/mailboxes?page=${page}&limit=20`),
    enabled: canListMailboxes,
  });

  const listLoading = onboardingLoading || (canListMailboxes && mailboxesLoading);
  const mailboxes = data?.data ?? [];

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      await api.delete(`/mailboxes/${deleteTarget.id}`);
      toast({ title: "Mailbox deleted" });
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["org-mailboxes"] });
      await invalidatePlanUsage(queryClient);
    } catch (err) {
      toast({
        title: "Delete failed",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (id: string) => {
    try {
      await api.post(`/mailboxes/${id}/suspend`, {});
      toast({ title: "Mailbox suspended" });
      await queryClient.invalidateQueries({ queryKey: ["org-mailboxes"] });
      await invalidatePlanUsage(queryClient);
    } catch (err) {
      toast({
        title: "Action failed",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await api.post(`/mailboxes/${id}/activate`);
      toast({ title: "Mailbox activated" });
      await queryClient.invalidateQueries({ queryKey: ["org-mailboxes"] });
      await invalidatePlanUsage(queryClient);
    } catch (err) {
      if (isPlanLimitError(err)) {
        setShowUpgrade(true);
      }
      toast({
        title: "Action failed",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const columns: ColumnDef<MailboxRow>[] = [
    {
      accessorKey: "email",
      header: "Email Address",
      cell: ({ row }) => (
        <p className="font-medium">{row.original.email}</p>
      ),
    },
    {
      accessorKey: "displayName",
      header: "Display Name",
      cell: ({ row }) => row.original.displayName ?? "—",
    },
    {
      accessorKey: "domain",
      header: "Domain",
      cell: ({ row }) => row.original.domain?.name ?? "—",
    },
    {
      id: "quota",
      header: "Quota",
      cell: ({ row }) => formatBytes(toSafeBigInt(row.original.quotaBytes)),
    },
    {
      id: "storageUsed",
      header: "Storage Used",
      cell: ({ row }) => {
        const used = toSafeBigInt(row.original.usedBytes);
        const quota = toSafeBigInt(row.original.quotaBytes);
        const percent =
          quota > BigInt(0) ? Number((used * BigInt(100)) / quota) : 0;

        return (
          <div>
            <p className="text-sm">{formatBytes(used)}</p>
            <div className="mt-1 h-1.5 w-24 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.status === "ACTIVE"
              ? "success"
              : row.original.status === "SUSPENDED"
                ? "destructive"
                : "secondary"
          }
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created Date",
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const m = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/org/mailboxes/${m.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openWebmail(m.id)}>
                <Mail className="mr-2 h-4 w-4" />
                Open Webmail
                <ExternalLink className="ml-auto h-3.5 w-3.5" />
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/org/mailboxes/${m.id}?tab=password`}>
                  <Key className="mr-2 h-4 w-4" />
                  Reset Password
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/org/mailboxes/${m.id}?tab=quota`}>
                  <HardDrive className="mr-2 h-4 w-4" />
                  Change Quota
                </Link>
              </DropdownMenuItem>
              {m.status === "ACTIVE" ? (
                <DropdownMenuItem onClick={() => handleSuspend(m.id)}>
                  <ShieldOff className="mr-2 h-4 w-4" />
                  Suspend
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleActivate(m.id)}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Activate
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteTarget(m)}
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
    <DashboardLayout variant="org" title="Mailboxes">
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {mailboxLimitReached && planUsage && (
            <PlanLimitBanner
              message={planUsage.limitMessages.mailbox}
              onUpgrade={() => setShowUpgrade(true)}
            />
          )}
        </div>
        <PlanUsageCard compact />
      </div>

      <div className="mb-6 flex items-center justify-between">
        <p className="text-muted-foreground">
          Manage email accounts across verified domains
        </p>
        <div className="flex gap-2">
          {mailboxLimitReached && (
            <Button variant="outline" onClick={() => setShowUpgrade(true)}>
              <ArrowUpCircle className="mr-2 h-4 w-4" />
              Upgrade Plan
            </Button>
          )}
          {mailboxLimitReached ? (
            <Button disabled>
              <Plus className="mr-2 h-4 w-4" />
              Create Mailbox
            </Button>
          ) : (
            <Button asChild>
              <Link href="/org/mailboxes/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Mailbox
              </Link>
            </Button>
          )}
        </div>
      </div>

      {(onboardingError || isError) && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
          <span>
            {onboardingError
              ? "Failed to load onboarding status."
              : getApiErrorMessage(error, "Failed to load mailboxes.")}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (onboardingError) {
                void queryClient.invalidateQueries({
                  queryKey: ["onboarding-status"],
                });
              } else {
                void refetch();
              }
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {!listLoading && !isError && canListMailboxes && mailboxes.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center">
          <p className="text-muted-foreground">No mailboxes yet.</p>
          {!mailboxLimitReached && (
            <Button asChild className="mt-4" variant="outline">
              <Link href="/org/mailboxes/new">
                <Plus className="mr-2 h-4 w-4" />
                Create your first mailbox
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={mailboxes}
          loading={listLoading}
          pagination={{
            page,
            totalPages: data?.meta?.totalPages ?? 1,
            onPageChange: setPage,
          }}
        />
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete mailbox?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting <strong>{deleteTarget?.email}</strong> will permanently
              remove all emails, aliases, and forwarders associated with this
              mailbox. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete Mailbox
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpgradePlanDialog open={showUpgrade} onOpenChange={setShowUpgrade} />
    </DashboardLayout>
  );
}
