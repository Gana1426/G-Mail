"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/sidebar";
import { api } from "@/services/api.client";
import { useToast } from "@/hooks/use-toast";
import { notifyError, notifySuccess } from "@/utils/api-notify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes, formatDateTime } from "@/utils";
import {
  Loader2,
  Globe,
  Mail,
  Users,
  Forward,
  ShieldOff,
  ShieldCheck,
  Trash2,
  AlertCircle,
} from "lucide-react";

interface OrgDetails {
  organization: {
    id: string;
    name: string;
    slug: string;
    status: string;
    description: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    address: string | null;
    storageQuota: string;
    storageUsed: string;
    maxDomains: number;
    maxMailboxes: number;
    createdAt: string;
    updatedAt: string;
    plan?: { id: string; name: string; tier: string; code: string } | null;
    owner?: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      status: string;
      lastLoginAt: string | null;
    } | null;
    domains: Array<{ id: string; name: string; status: string }>;
    mailboxes: Array<{
      id: string;
      email: string;
      status: string;
      usedBytes: string;
      quotaBytes: string;
    }>;
    _count: {
      domains: number;
      mailboxes: number;
      aliases: number;
      forwarders: number;
      users: number;
    };
  };
  activity: Array<{
    id: string;
    action: string;
    description: string | null;
    createdAt: string;
  }>;
  planUsage: {
    domains: { used: number; limit: number };
    mailboxes: { used: number; limit: number };
    storage: { used: string; limit: string; percent: number };
    aliasesEnabled: boolean;
    forwardersEnabled: boolean;
    plan: { name: string; tier: string };
  };
}

interface Plan {
  id: string;
  name: string;
  tier: string;
}

export default function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <OrganizationDetailContent params={params} />
    </Suspense>
  );
}

function OrganizationDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "overview";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showSuspend, setShowSuspend] = useState(false);
  const [permanentDelete, setPermanentDelete] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    slug: "",
    description: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
  });
  const [password, setPassword] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["org-details", id],
    queryFn: async () => {
      const res = await api.get<OrgDetails>(`/organizations/${id}/details`);
      return res.data!;
    },
    retry: 1,
  });

  const org = data?.organization;
  const usage = data?.planUsage;

  useEffect(() => {
    if (org) {
      setEditForm({
        name: org.name,
        slug: org.slug,
        description: org.description ?? "",
        contactEmail: org.contactEmail ?? "",
        contactPhone: org.contactPhone ?? "",
        address: org.address ?? "",
      });
      setSelectedPlanId(org.plan?.id ?? "");
    }
  }, [org]);

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await api.get<Plan[]>("/plans?limit=50");
      return res.data ?? [];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["org-details", id] });
    queryClient.invalidateQueries({ queryKey: ["organizations"] });
  };

  const saveEdit = async () => {
    if (editForm.name.trim().length < 2) {
      toast({
        variant: "warning",
        title: "Validation error",
        description: "Organization name must be at least 2 characters",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch(`/organizations/${id}`, editForm);
      notifySuccess(toast, res, "Organization updated");
      await invalidate();
    } catch (err) {
      notifyError(toast, err, "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (generate = false) => {
    if (!generate && password.length < 8) {
      toast({
        variant: "warning",
        title: "Validation error",
        description: "Password must be at least 8 characters",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<{
        email: string;
        generatedPassword?: string;
      }>(`/organizations/${id}/reset-owner-password`, {
        ...(generate ? { generate: true } : { password }),
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
      if (!pwd) setPassword("");
    } catch (err) {
      notifyError(toast, err, "Reset failed");
    } finally {
      setSaving(false);
    }
  };

  const changePlan = async () => {
    if (!selectedPlanId) return;
    setSaving(true);
    try {
      const res = await api.post(`/organizations/${id}/change-plan`, {
        planId: selectedPlanId,
      });
      notifySuccess(toast, res, "Plan updated");
      await invalidate();
    } catch (err) {
      notifyError(toast, err, "Plan change failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSuspendToggle = async () => {
    setSaving(true);
    try {
      const res =
        org?.status === "SUSPENDED"
          ? await api.post(`/organizations/${id}/suspend`, { action: "activate" })
          : await api.post(`/organizations/${id}/suspend`, {
              action: "suspend",
              reason: "Suspended by super admin",
            });
      notifySuccess(toast, res);
      setShowSuspend(false);
      await invalidate();
    } catch (err) {
      notifyError(toast, err, "Action failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      const res = permanentDelete
        ? await api.delete(`/organizations/${id}/permanent-delete`)
        : await api.delete(`/organizations/${id}`);
      notifySuccess(toast, res);
      setShowDelete(false);
      if (permanentDelete) {
        router.push("/admin/organizations");
      } else {
        await invalidate();
      }
    } catch (err) {
      notifyError(toast, err, "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout variant="admin" title="Organization">
        <Skeleton className="h-64 w-full" />
      </DashboardLayout>
    );
  }

  if (isError || !org) {
    return (
      <DashboardLayout variant="admin" title="Organization">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-muted-foreground">
              {error instanceof Error
                ? error.message
                : "Failed to load organization"}
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const formatLimit = (n: number) => (n === -1 ? "∞" : String(n));

  return (
    <DashboardLayout
      variant="admin"
      title={org.name}
      breadcrumbs={[
        { label: "Organizations", href: "/admin/organizations" },
        { label: org.name },
      ]}
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge
          variant={
            org.status === "ACTIVE"
              ? "success"
              : org.status === "SUSPENDED"
                ? "destructive"
                : org.status === "PENDING"
                  ? "warning"
                  : "secondary"
          }
        >
          {org.status}
        </Badge>
        <Badge variant="outline">{org.plan?.name ?? "No Plan"}</Badge>
        {org.status !== "DELETED" && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSuspend(true)}
            >
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
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => {
                setPermanentDelete(false);
                setShowDelete(true);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </>
        )}
      </div>

      <div className="mb-6 flex gap-2 border-b">
        {[
          { key: "overview", label: "Overview" },
          { key: "edit", label: "Edit" },
          { key: "password", label: "Reset Password" },
          { key: "plan", label: "Change Plan" },
        ].map((t) => (
          <Link
            key={t.key}
            href={`/admin/organizations/${id}?tab=${t.key}`}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Organization Information</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Name</p>
                  <p className="font-medium">{org.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Slug</p>
                  <p>{org.slug}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Contact Email</p>
                  <p>{org.contactEmail ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Contact Phone</p>
                  <p>{org.contactPhone ?? "—"}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground">Description</p>
                  <p>{org.description ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge
                    variant={
                      org.status === "ACTIVE"
                        ? "success"
                        : org.status === "SUSPENDED"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {org.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Current Plan</p>
                  <p className="font-medium">{org.plan?.name ?? "No Plan"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created Date</p>
                  <p>{formatDateTime(org.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Updated</p>
                  <p>{formatDateTime(org.updatedAt)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Owner Information</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                {org.owner ? (
                  <>
                    <div>
                      <p className="text-muted-foreground">Name</p>
                      <p className="font-medium">
                        {org.owner.firstName} {org.owner.lastName}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p>{org.owner.email}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <Badge variant="outline">{org.owner.status}</Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Last Login</p>
                      <p>
                        {org.owner.lastLoginAt
                          ? formatDateTime(org.owner.lastLoginAt)
                          : "—"}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground sm:col-span-2">
                    No owner assigned
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {data?.activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity</p>
                ) : (
                  <ul className="space-y-3">
                    {data?.activity.map((log) => (
                      <li key={log.id} className="text-sm">
                        <p className="font-medium">{log.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.description ?? "—"} ·{" "}
                          {formatDateTime(log.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Usage Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Domains Count</span>
                  <span className="font-medium">{org._count.domains}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mailboxes Count</span>
                  <span className="font-medium">{org._count.mailboxes}</span>
                </div>
                <div>
                  <div className="mb-1 flex justify-between">
                    <span className="text-muted-foreground">Storage Usage</span>
                    <span>
                      {formatBytes(BigInt(org.storageUsed))} /{" "}
                      {formatBytes(BigInt(org.storageQuota))}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${usage?.storage.percent ?? 0}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {usage?.storage.percent ?? 0}% used
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Plan Limits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <div className="mb-1 flex justify-between">
                    <span>Domains</span>
                    <span>
                      {usage?.domains.used ?? 0} /{" "}
                      {formatLimit(usage?.domains.limit ?? 0)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${
                          usage?.domains.limit === -1
                            ? 0
                            : Math.min(
                                ((usage?.domains.used ?? 0) /
                                  (usage?.domains.limit || 1)) *
                                  100,
                                100
                              )
                        }%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between">
                    <span>Mailboxes</span>
                    <span>
                      {usage?.mailboxes.used ?? 0} /{" "}
                      {formatLimit(usage?.mailboxes.limit ?? 0)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${
                          usage?.mailboxes.limit === -1
                            ? 0
                            : Math.min(
                                ((usage?.mailboxes.used ?? 0) /
                                  (usage?.mailboxes.limit || 1)) *
                                  100,
                                100
                              )
                        }%`,
                      }}
                    />
                  </div>
                </div>
                <div className="flex justify-between">
                  <span>Aliases</span>
                  <span>{usage?.aliasesEnabled ? "Enabled" : "Disabled"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Forwarders</span>
                  <span>
                    {usage?.forwardersEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resources</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  {org._count.domains} Domains
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {org._count.mailboxes} Mailboxes
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {org._count.aliases} Aliases
                </div>
                <div className="flex items-center gap-2">
                  <Forward className="h-4 w-4 text-muted-foreground" />
                  {org._count.forwarders} Forwarders
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === "edit" && (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Edit Organization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={editForm.slug}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, slug: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Email</Label>
              <Input
                type="email"
                value={editForm.contactEmail}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, contactEmail: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input
                value={editForm.contactPhone}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, contactPhone: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={editForm.address}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, address: e.target.value }))
                }
              />
            </div>
            <Button onClick={saveEdit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "password" && (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Reset Owner Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Reset password for {org.owner?.email ?? "organization owner"}
            </p>
            {generatedPassword ? (
              <div className="rounded-lg border bg-muted p-3">
                <p className="text-sm font-medium">Generated password</p>
                <p className="mt-1 font-mono text-sm">{generatedPassword}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>New Password</Label>
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                />
              </div>
            )}
            <div className="flex gap-2">
              {generatedPassword ? (
                <Button onClick={() => setGeneratedPassword(null)}>
                  Reset Another
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => resetPassword(true)}
                    disabled={saving}
                  >
                    Generate Password
                  </Button>
                  <Button
                    onClick={() => resetPassword(false)}
                    disabled={saving || password.length < 8}
                  >
                    {saving && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Reset Password
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "plan" && (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Change Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Current: {org.plan?.name ?? "None"}
            </p>
            <div className="space-y-2">
              <Label>Select Plan</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.tier})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={changePlan}
              disabled={saving || !selectedPlanId}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply Plan
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showSuspend} onOpenChange={setShowSuspend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {org.status === "SUSPENDED"
                ? "Activate organization?"
                : "Suspend organization?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {org.status === "SUSPENDED"
                ? "Restore access for all users in this organization."
                : "All users in this organization will lose access until reactivated."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                handleSuspendToggle();
              }}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {org.status === "SUSPENDED" ? "Activate" : "Suspend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showDelete}
        onOpenChange={(open) => {
          if (!open) {
            setShowDelete(false);
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
                  This will permanently delete <strong>{org.name}</strong> and
                  all associated data. This cannot be undone.
                </>
              ) : (
                <>
                  Mark <strong>{org.name}</strong> as deleted. Data is retained
                  but the organization will be disabled.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            {!permanentDelete && (
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => setPermanentDelete(true)}
              >
                Permanent Delete
              </Button>
            )}
            <AlertDialogAction
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {permanentDelete ? "Permanent Delete" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
