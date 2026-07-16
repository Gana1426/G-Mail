"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DashboardLayout } from "@/components/layout/sidebar";
import { api } from "@/services/api.client";
import { useToast } from "@/hooks/use-toast";
import { openWebmail } from "@/lib/webmail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  resetMailboxPasswordSchema,
  updateMailboxSchema,
} from "@/utils/validation";
import { z } from "zod";
import { formatBytes, formatDateTime } from "@/utils";
import {
  Loader2,
  Mail,
  ExternalLink,
  ShieldOff,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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

type UpdateForm = z.infer<typeof updateMailboxSchema>;
type PasswordForm = z.infer<typeof resetMailboxPasswordSchema>;

const QUOTA_OPTIONS = [
  { label: "1 GB", bytes: 1 * 1024 * 1024 * 1024 },
  { label: "2 GB", bytes: 2 * 1024 * 1024 * 1024 },
  { label: "5 GB", bytes: 5 * 1024 * 1024 * 1024 },
  { label: "10 GB", bytes: 10 * 1024 * 1024 * 1024 },
  { label: "25 GB", bytes: 25 * 1024 * 1024 * 1024 },
  { label: "50 GB", bytes: 50 * 1024 * 1024 * 1024 },
];

interface MailboxDetails {
  mailbox: {
    id: string;
    email: string;
    displayName: string | null;
    firstName: string | null;
    lastName: string | null;
    status: string;
    quotaBytes: string;
    usedBytes: string;
    passwordChangedAt?: string | null;
    createdAt: string;
    updatedAt: string;
    domain: { name: string };
  };
  aliases: Array<{ id: string; address: string }>;
  forwarders: Array<{
    id: string;
    sourceEmail: string;
    targetEmail: string | null;
  }>;
  activity: Array<{
    id: string;
    action: string;
    createdAt: string;
    ipAddress?: string | null;
  }>;
  usage: {
    usedBytes: string;
    quotaBytes: string;
    remaining: string;
    usagePercent: number;
  };
}

export default function MailboxDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <MailboxDetailContent params={params} />
    </Suspense>
  );
}

function MailboxDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "details";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["mailbox-details", id],
    queryFn: async () => {
      const res = await api.get<MailboxDetails>(`/mailboxes/${id}/details`);
      return res.data!;
    },
  });

  const mailbox = data?.mailbox;

  const updateForm = useForm<UpdateForm>({
    resolver: zodResolver(updateMailboxSchema),
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(resetMailboxPasswordSchema),
  });

  useEffect(() => {
    if (mailbox) {
      updateForm.reset({
        firstName: mailbox.firstName ?? "",
        lastName: mailbox.lastName ?? "",
        displayName: mailbox.displayName ?? "",
      });
    }
  }, [mailbox, updateForm]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["mailbox-details", id] });
    void queryClient.invalidateQueries({ queryKey: ["org-mailboxes"] });
  };

  const handleUpdate = async (formData: UpdateForm) => {
    setSaving(true);
    try {
      await api.patch(`/mailboxes/${id}`, formData);
      toast({ title: "Mailbox updated" });
      await invalidate();
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async (formData: PasswordForm) => {
    setSaving(true);
    try {
      await api.post(`/mailboxes/${id}/reset-password`, formData);
      toast({ title: "Password reset successfully" });
      passwordForm.reset();
      await invalidate();
    } catch (error) {
      toast({
        title: "Reset failed",
        description: error instanceof Error ? error.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleQuotaChange = async (quotaBytes: number) => {
    setSaving(true);
    try {
      await api.patch(`/mailboxes/${id}`, { quotaBytes });
      toast({ title: "Quota updated" });
      await invalidate();
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSuspend = async () => {
    try {
      await api.post(`/mailboxes/${id}/suspend`, {});
      toast({ title: "Mailbox suspended" });
      await invalidate();
    } catch (error) {
      toast({
        title: "Action failed",
        variant: "destructive",
      });
    }
  };

  const handleActivate = async () => {
    try {
      await api.post(`/mailboxes/${id}/activate`);
      toast({ title: "Mailbox activated" });
      await invalidate();
    } catch (error) {
      toast({
        title: "Action failed",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/mailboxes/${id}`);
      toast({ title: "Mailbox deleted" });
      window.location.href = "/org/mailboxes";
    } catch (error) {
      toast({
        title: "Delete failed",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
      setShowDelete(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout variant="org" title="Mailbox">
        <Skeleton className="h-64 w-full" />
      </DashboardLayout>
    );
  }

  if (!mailbox || !data) {
    return (
      <DashboardLayout variant="org" title="Mailbox not found">
        <p>Mailbox not found</p>
      </DashboardLayout>
    );
  }

  const usagePercent = data.usage.usagePercent;

  return (
    <DashboardLayout
      variant="org"
      title={mailbox.email}
      breadcrumbs={[
        { label: "Mailboxes", href: "/org/mailboxes" },
        { label: mailbox.email },
      ]}
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge
          variant={
            mailbox.status === "ACTIVE"
              ? "success"
              : mailbox.status === "SUSPENDED"
                ? "destructive"
                : "secondary"
          }
        >
          {mailbox.status}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={() => openWebmail(id)}
        >
          <Mail className="mr-2 h-4 w-4" />
          Open Webmail
          <ExternalLink className="ml-2 h-3.5 w-3.5" />
        </Button>
        {mailbox.status === "ACTIVE" ? (
          <Button variant="outline" size="sm" onClick={handleSuspend}>
            <ShieldOff className="mr-2 h-4 w-4" />
            Suspend
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={handleActivate}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Activate
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          onClick={() => setShowDelete(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>

      <div className="mb-6 flex gap-2 border-b">
        {[
          { key: "details", label: "Details" },
          { key: "password", label: "Reset Password" },
          { key: "quota", label: "Change Quota" },
        ].map((t) => (
          <Link
            key={t.key}
            href={`/org/mailboxes/${id}?tab=${t.key}`}
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {tab === "details" && (
            <Card>
              <CardHeader>
                <CardTitle>Edit Mailbox</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={updateForm.handleSubmit(handleUpdate)}
                  className="space-y-4"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>First Name</Label>
                      <Input {...updateForm.register("firstName")} />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name</Label>
                      <Input {...updateForm.register("lastName")} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input {...updateForm.register("displayName")} />
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Changes
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {tab === "password" && (
            <Card>
              <CardHeader>
                <CardTitle>Reset Password</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={passwordForm.handleSubmit(handlePasswordReset)}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label>New Password</Label>
                    <PasswordInput
                      {...passwordForm.register("password")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm Password</Label>
                    <PasswordInput
                      {...passwordForm.register("confirmPassword")}
                    />
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Reset Password
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {tab === "quota" && (
            <Card>
              <CardHeader>
                <CardTitle>Change Quota</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Current: {formatBytes(BigInt(mailbox.quotaBytes))}
                </p>
                <Select
                  onValueChange={(v) => handleQuotaChange(parseInt(v, 10))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select new quota" />
                  </SelectTrigger>
                  <SelectContent>
                    {QUOTA_OPTIONS.map((q) => (
                      <SelectItem key={q.bytes} value={String(q.bytes)}>
                        {q.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Aliases</CardTitle>
            </CardHeader>
            <CardContent>
              {data.aliases.length === 0 ? (
                <p className="text-sm text-muted-foreground">No aliases</p>
              ) : (
                <ul className="space-y-2">
                  {data.aliases.map((a) => (
                    <li key={a.id} className="text-sm">
                      {a.address}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Forwarders</CardTitle>
            </CardHeader>
            <CardContent>
              {data.forwarders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No forwarders</p>
              ) : (
                <ul className="space-y-2">
                  {data.forwarders.map((f) => (
                    <li key={f.id} className="text-sm">
                      {f.sourceEmail} → {f.targetEmail ?? "—"}
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
              <CardTitle>Mailbox Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{mailbox.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Display Name</span>
                <span>{mailbox.displayName ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Domain</span>
                <span>{mailbox.domain.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge
                  variant={
                    mailbox.status === "ACTIVE" ? "success" : "destructive"
                  }
                >
                  {mailbox.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Storage Used</span>
                <span>{formatBytes(BigInt(data.usage.usedBytes))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Storage Limit</span>
                <span>{formatBytes(BigInt(data.usage.quotaBytes))}</span>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-muted-foreground">
                  <span>Usage</span>
                  <span>{usagePercent}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(usagePercent, 100)}%` }}
                  />
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDateTime(mailbox.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span>{formatDateTime(mailbox.updatedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Password Changed</span>
                <span>
                  {mailbox.passwordChangedAt
                    ? formatDateTime(mailbox.passwordChangedAt)
                    : "—"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {data.activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity</p>
              ) : (
                <ul className="space-y-3">
                  {data.activity.map((log) => (
                    <li key={log.id} className="text-sm">
                      <p className="font-medium">{log.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(log.createdAt)}
                        {log.ipAddress ? ` · ${log.ipAddress}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete mailbox?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting <strong>{mailbox.email}</strong> will permanently remove
              all emails and configuration. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete Mailbox
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
