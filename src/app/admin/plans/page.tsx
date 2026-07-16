"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { DashboardLayout } from "@/components/layout/sidebar";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/services/api.client";
import { useToast } from "@/hooks/use-toast";
import { formatBytes } from "@/utils";
import { Plus, Copy, Power, PowerOff, Pencil, Loader2 } from "lucide-react";

interface Plan {
  id: string;
  code: string;
  name: string;
  tier: string;
  status: string;
  maxDomains: number;
  maxMailboxes: number;
  storageQuotaBytes: string;
  aliasesEnabled: boolean;
  forwardersEnabled: boolean;
  monthlyPrice: number;
  yearlyPrice: number;
  _count?: { organizations: number };
}

const EMPTY_FORM = {
  code: "",
  name: "",
  tier: "FREE",
  description: "",
  maxDomains: 1,
  maxMailboxes: 2,
  storageQuotaBytes: 1073741824,
  aliasesEnabled: false,
  forwardersEnabled: false,
  monthlyPrice: 0,
  yearlyPrice: 0,
};

export default function PlansPage() {
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Plan | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["plans", page],
    queryFn: () => api.get<Plan[]>(`/plans?page=${page}&limit=20`),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditing(plan);
    setForm({
      code: plan.code,
      name: plan.name,
      tier: plan.tier,
      description: "",
      maxDomains: plan.maxDomains,
      maxMailboxes: plan.maxMailboxes,
      storageQuotaBytes: parseInt(plan.storageQuotaBytes, 10),
      aliasesEnabled: plan.aliasesEnabled,
      forwardersEnabled: plan.forwardersEnabled,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
    });
    setDialogOpen(true);
  };

  const savePlan = async () => {
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/plans/${editing.id}`, form);
        toast({ title: "Plan updated" });
      } else {
        await api.post("/plans", form);
        toast({ title: "Plan created" });
      }
      setDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["plans"] });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const clonePlan = async (plan: Plan) => {
    const code = `${plan.code}_COPY_${Date.now().toString(36).slice(-4).toUpperCase()}`;
    setSaving(true);
    try {
      await api.post(`/plans/${plan.id}/clone`, { code });
      toast({
        title: "Plan cloned",
        description: `Created ${code} from ${plan.name}.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["plans"] });
    } catch (error) {
      toast({
        title: "Clone failed",
        description: error instanceof Error ? error.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmToggleStatus = async () => {
    if (!statusTarget) return;
    setStatusLoading(true);
    try {
      if (statusTarget.status === "ACTIVE") {
        await api.post(`/plans/${statusTarget.id}/deactivate`);
        toast({
          title: "Plan deactivated",
          description: `${statusTarget.name} is no longer available for new subscriptions.`,
        });
      } else {
        await api.post(`/plans/${statusTarget.id}/activate`);
        toast({
          title: "Plan activated",
          description: `${statusTarget.name} is now available for organizations.`,
        });
      }
      setStatusTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["plans"] });
    } catch (error) {
      toast({
        title: "Action failed",
        description: error instanceof Error ? error.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setStatusLoading(false);
    }
  };

  const columns: ColumnDef<Plan>[] = [
    { accessorKey: "name", header: "Plan Name" },
    { accessorKey: "tier", header: "Tier" },
    {
      accessorKey: "maxDomains",
      header: "Domains",
      cell: ({ row }) =>
        row.original.maxDomains === -1 ? "∞" : row.original.maxDomains,
    },
    {
      accessorKey: "maxMailboxes",
      header: "Mailboxes",
      cell: ({ row }) =>
        row.original.maxMailboxes === -1 ? "∞" : row.original.maxMailboxes,
    },
    {
      id: "storage",
      header: "Storage",
      cell: ({ row }) =>
        formatBytes(BigInt(row.original.storageQuotaBytes)),
    },
    {
      accessorKey: "monthlyPrice",
      header: "Monthly",
      cell: ({ row }) => `$${row.original.monthlyPrice}`,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "ACTIVE" ? "success" : "secondary"}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const plan = row.original;
        return (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => openEdit(plan)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => clonePlan(plan)}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setStatusTarget(plan)}>
              {plan.status === "ACTIVE" ? (
                <PowerOff className="h-4 w-4" />
              ) : (
                <Power className="h-4 w-4" />
              )}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <DashboardLayout variant="admin" title="Subscription Plans">
      <div className="mb-6 flex justify-between">
        <p className="text-muted-foreground">
          Manage subscription plans and limits
        </p>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Plan
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        pagination={{
          page,
          totalPages: data?.meta?.totalPages ?? 1,
          onPageChange: setPage,
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Plan" : "Create Plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={form.code}
                  disabled={!!editing}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tier</Label>
              <Select
                value={form.tier}
                onValueChange={(v) => setForm((f) => ({ ...f, tier: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["FREE", "PRO", "BUSINESS", "ENTERPRISE"].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Max Domains (-1 = unlimited)</Label>
                <Input
                  type="number"
                  value={form.maxDomains}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      maxDomains: parseInt(e.target.value, 10),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Max Mailboxes (-1 = unlimited)</Label>
                <Input
                  type="number"
                  value={form.maxMailboxes}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      maxMailboxes: parseInt(e.target.value, 10),
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Storage (bytes)</Label>
              <Input
                type="number"
                value={form.storageQuotaBytes}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    storageQuotaBytes: parseInt(e.target.value, 10),
                  }))
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Monthly Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.monthlyPrice}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      monthlyPrice: parseFloat(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Yearly Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.yearlyPrice}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      yearlyPrice: parseFloat(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.aliasesEnabled}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, aliasesEnabled: e.target.checked }))
                  }
                />
                Aliases
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.forwardersEnabled}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      forwardersEnabled: e.target.checked,
                    }))
                  }
                />
                Forwarders
              </label>
            </div>
            <Button onClick={savePlan} disabled={saving} className="w-full">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Update Plan" : "Create Plan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!statusTarget}
        onOpenChange={(open) => !open && setStatusTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusTarget?.status === "ACTIVE"
                ? "Deactivate plan?"
                : "Activate plan?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget?.status === "ACTIVE" ? (
                <>
                  Deactivating <strong>{statusTarget?.name}</strong> will prevent
                  new organizations from selecting this plan. Existing
                  organizations on this plan will not be affected.
                </>
              ) : (
                <>
                  Activating <strong>{statusTarget?.name}</strong> will make this
                  plan available for organizations to choose during onboarding
                  or plan changes.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={statusLoading}
              onClick={(e) => {
                e.preventDefault();
                confirmToggleStatus();
              }}
            >
              {statusLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {statusTarget?.status === "ACTIVE" ? "Deactivate" : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
