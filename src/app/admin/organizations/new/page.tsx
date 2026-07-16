"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/sidebar";
import { api } from "@/services/api.client";
import { useToast } from "@/hooks/use-toast";
import { notifyError, notifySuccess } from "@/utils/api-notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  tier: string;
  code: string;
}

export default function NewOrganizationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    planId: "",
    ownerEmail: "",
    ownerFirstName: "",
    ownerLastName: "",
    ownerPassword: "",
  });

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await api.get<Plan[]>("/plans?limit=50");
      return res.data ?? [];
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post("/organizations", {
        name: form.name,
        slug: form.slug || undefined,
        description: form.description || undefined,
        planId: form.planId || undefined,
        ownerEmail: form.ownerEmail || undefined,
        ownerFirstName: form.ownerFirstName || undefined,
        ownerLastName: form.ownerLastName || undefined,
        ownerPassword: form.ownerPassword || undefined,
      });
      notifySuccess(toast, res, "Organization created");
      const org = res.data as { id: string };
      router.push(`/admin/organizations/${org.id}`);
    } catch (error) {
      notifyError(toast, error, "Creation failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout
      variant="admin"
      title="Create Organization"
      breadcrumbs={[
        { label: "Organizations", href: "/admin/organizations" },
        { label: "New" },
      ]}
    >
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Organization Name *</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="auto-generated if empty"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Subscription Plan *</Label>
              <Select
                value={form.planId}
                onValueChange={(v) => setForm((f) => ({ ...f, planId: v }))}
              >
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

            <div className="border-t pt-4">
              <p className="mb-3 text-sm font-medium">Owner Account (optional)</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input
                    value={form.ownerFirstName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, ownerFirstName: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    value={form.ownerLastName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, ownerLastName: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Label>Owner Email</Label>
                <Input
                  type="email"
                  value={form.ownerEmail}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ownerEmail: e.target.value }))
                  }
                />
              </div>
              <div className="mt-4 space-y-2">
                <Label>Owner Password</Label>
                <PasswordInput
                  value={form.ownerPassword}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ownerPassword: e.target.value }))
                  }
                />
              </div>
            </div>

            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Organization
            </Button>
          </form>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
