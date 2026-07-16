"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { DashboardLayout } from "@/components/layout/sidebar";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/services/api.client";
import { useToast } from "@/hooks/use-toast";
import { notifyError, notifySuccess } from "@/utils/api-notify";
import { formatDateTime } from "@/utils";
import {
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  ShieldOff,
  ShieldCheck,
  Trash2,
  Key,
  Globe,
  Mail,
  Search,
  Loader2,
} from "lucide-react";

interface Organization {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan?: { id: string; name: string; tier: string } | null;
  _count: { domains: number; mailboxes: number; users: number };
  createdAt: string;
  updatedAt: string;
}

interface PlanOption {
  id: string;
  name: string;
  tier: string;
}

const statusVariant: Record<
  string,
  "success" | "warning" | "destructive" | "secondary"
> = {
  ACTIVE: "success",
  PENDING: "warning",
  SUSPENDED: "destructive",
  DELETED: "secondary",
};

export default function OrganizationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [planId, setPlanId] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Organization | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<Organization | null>(null);
  const [permanentDelete, setPermanentDelete] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
    });
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (status !== "all") params.set("status", status);
    if (planId !== "all") params.set("planId", planId);
    return params.toString();
  }, [page, debouncedSearch, status, planId]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["organizations", queryString],
    queryFn: () => api.get<Organization[]>(`/organizations?${queryString}`),
  });

  const { data: plans } = useQuery({
    queryKey: ["plans-filter"],
    queryFn: async () => {
      const res = await api.get<PlanOption[]>("/plans?limit=50");
      return res.data ?? [];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["organizations"] });

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    setActionLoading(true);
    try {
      const res =
        suspendTarget.status === "SUSPENDED"
          ? await api.post(`/organizations/${suspendTarget.id}/suspend`, {
              action: "activate",
            })
          : await api.post(`/organizations/${suspendTarget.id}/suspend`, {
              action: "suspend",
              reason: "Suspended by super admin",
            });
      notifySuccess(toast, res);
      setSuspendTarget(null);
      await invalidate();
    } catch (error) {
      notifyError(toast, error, "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      const res = permanentDelete
        ? await api.delete(`/organizations/${deleteTarget.id}/permanent-delete`)
        : await api.delete(`/organizations/${deleteTarget.id}`);
      notifySuccess(toast, res);
      setDeleteTarget(null);
      setPermanentDelete(false);
      await invalidate();
    } catch (error) {
      notifyError(toast, error, "Delete failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (generate = false) => {
    if (!passwordTarget) return;
    if (!generate && newPassword.length < 8) {
      toast({
        variant: "warning",
        title: "Validation error",
        description: "Password must be at least 8 characters",
      });
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.post<{
        email: string;
        generatedPassword?: string;
      }>(`/organizations/${passwordTarget.id}/reset-owner-password`, {
        ...(generate ? { generate: true } : { password: newPassword }),
      });
      const pwd = res.data?.generatedPassword;
      if (pwd) setGeneratedPassword(pwd);
      toast({
        variant: "success",
        title: res.message ?? "Password reset successful",
        description: pwd
          ? `New password for ${res.data?.email}: ${pwd}`
          : res.data?.email
            ? `Password updated for ${res.data.email}`
            : undefined,
      });
      if (!pwd) {
        setPasswordTarget(null);
        setNewPassword("");
      }
    } catch (error) {
      notifyError(toast, error, "Reset failed");
    } finally {
      setActionLoading(false);
    }
  };

  const columns: ColumnDef<Organization>[] = [
    {
      accessorKey: "name",
      header: "Organization Name",
      cell: ({ row }) => (
        <div>
          <button
            type="button"
            className="font-medium text-left hover:text-primary hover:underline"
            onClick={() =>
              router.push(`/admin/organizations/${row.original.id}`)
            }
          >
            {row.original.name}
          </button>
          <p className="text-xs text-muted-foreground">{row.original.slug}</p>
        </div>
      ),
    },
    {
      accessorKey: "plan",
      header: "Plan",
      cell: ({ row }) => row.original.plan?.name ?? "—",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariant[row.original.status] ?? "secondary"}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "domains",
      header: "Domains",
      cell: ({ row }) => row.original._count.domains,
    },
    {
      id: "mailboxes",
      header: "Mailboxes",
      cell: ({ row }) => row.original._count.mailboxes,
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      accessorKey: "updatedAt",
      header: "Updated",
      cell: ({ row }) => formatDateTime(row.original.updatedAt),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const org = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() =>
                  router.push(`/admin/organizations/${org.id}`)
                }
              >
                <Eye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  router.push(`/admin/organizations/${org.id}?tab=edit`)
                }
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setGeneratedPassword(null);
                  setNewPassword("");
                  setPasswordTarget(org);
                }}
              >
                <Key className="mr-2 h-4 w-4" />
                Reset Password
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  router.push(`/admin/domains?organizationId=${org.id}`)
                }
              >
                <Globe className="mr-2 h-4 w-4" />
                View Domains
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  router.push(`/admin/mailboxes?organizationId=${org.id}`)
                }
              >
                <Mail className="mr-2 h-4 w-4" />
                View Mailboxes
              </DropdownMenuItem>
              {org.status !== "DELETED" && (
                <DropdownMenuItem onSelect={() => setSuspendTarget(org)}>
                  {org.status === "SUSPENDED" ? (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Activate
                    </>
                  ) : (
                    <>
                      <ShieldOff className="mr-2 h-4 w-4" />
                      Suspend
                    </>
                  )}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => {
                  setPermanentDelete(false);
                  setDeleteTarget(org);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => {
                  setPermanentDelete(true);
                  setDeleteTarget(org);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Permanent Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <DashboardLayout variant="admin" title="Organizations">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-muted-foreground">
          Manage all organizations on the platform
        </p>
        <Button asChild>
          <Link href="/admin/organizations/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Organization
          </Link>
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-1">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search name or slug..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="DELETED">Deleted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select
                value={planId}
                onValueChange={(v) => {
                  setPlanId(v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All plans" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  {plans?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading || isFetching}
        pagination={{
          page,
          totalPages: data?.meta?.totalPages ?? 1,
          onPageChange: setPage,
        }}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setPermanentDelete(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {permanentDelete
                ? "Permanently delete organization?"
                : "Delete organization?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {permanentDelete ? (
                <>
                  This will permanently delete{" "}
                  <strong>{deleteTarget?.name}</strong>, including all domains,
                  mailboxes, aliases, forwarders, maildir data, and audit logs.
                  This action cannot be undone.
                </>
              ) : (
                <>
                  Mark <strong>{deleteTarget?.name}</strong> as deleted. Data is
                  retained but the organization will be disabled until restored
                  by an administrator.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              {actionLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {permanentDelete ? "Permanent Delete" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!suspendTarget}
        onOpenChange={(open) => !open && setSuspendTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {suspendTarget?.status === "SUSPENDED"
                ? "Activate organization?"
                : "Suspend organization?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {suspendTarget?.status === "SUSPENDED" ? (
                <>
                  Activate <strong>{suspendTarget?.name}</strong> and restore
                  access for all users in this organization.
                </>
              ) : (
                <>
                  Suspend <strong>{suspendTarget?.name}</strong>. All users in
                  this organization will lose access until the organization is
                  reactivated.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              onClick={(e) => {
                e.preventDefault();
                handleSuspend();
              }}
            >
              {actionLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {suspendTarget?.status === "SUSPENDED" ? "Activate" : "Suspend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!passwordTarget}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordTarget(null);
            setNewPassword("");
            setGeneratedPassword(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Owner Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Reset password for organization{" "}
              <strong>{passwordTarget?.name}</strong>
            </p>
            {generatedPassword ? (
              <div className="rounded-lg border bg-muted p-3">
                <p className="text-sm font-medium">Generated password</p>
                <p className="mt-1 font-mono text-sm">{generatedPassword}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Copy this password now. It will not be shown again.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>New Password</Label>
                <PasswordInput
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            {generatedPassword ? (
              <Button
                onClick={() => {
                  setPasswordTarget(null);
                  setGeneratedPassword(null);
                }}
              >
                Done
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  disabled={actionLoading}
                  onClick={() => handleResetPassword(true)}
                >
                  {actionLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Generate Password
                </Button>
                <Button
                  disabled={actionLoading || newPassword.length < 8}
                  onClick={() => handleResetPassword(false)}
                >
                  {actionLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Reset Password
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
