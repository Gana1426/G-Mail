"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/sidebar";
import { api } from "@/services/api.client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { config } from "@/config";

interface OrgSettings {
  general?: {
    companyName?: string;
    timezone?: string;
    language?: string;
    dateFormat?: string;
    timeFormat?: string;
    theme?: string;
  };
  mail?: {
    smtpHost?: string;
    smtpPort?: number;
    imapPort?: number;
    pop3Port?: number;
    ssl?: boolean;
    tls?: boolean;
    maxMessageSize?: number;
    defaultQuotaBytes?: number;
  };
  security?: {
    passwordMinLength?: number;
    twoFactorRequired?: boolean;
    sessionTimeoutMinutes?: number;
    loginAlerts?: boolean;
    recoveryEmail?: string;
  };
}

export default function OrgSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["org-settings"],
    queryFn: async () => {
      const res = await api.get<{
        organization: { name: string };
        settings: OrgSettings;
      }>("/org/settings");
      return res.data!;
    },
  });

  const [form, setForm] = useState<OrgSettings>({});

  useEffect(() => {
    if (data) {
      setForm({
        general: {
          companyName: data.organization.name,
          timezone: "UTC",
          language: "en",
          dateFormat: "MMM d, yyyy",
          timeFormat: "12h",
          theme: "system",
          ...data.settings?.general,
        },
        mail: {
          smtpHost: config.mail.hostname,
          smtpPort: config.mail.smtpPort,
          imapPort: config.mail.imapPort,
          pop3Port: config.mail.pop3Port,
          ssl: true,
          tls: true,
          maxMessageSize: 52428800,
          defaultQuotaBytes: 5368709120,
          ...data.settings?.mail,
        },
        security: {
          passwordMinLength: 8,
          twoFactorRequired: false,
          sessionTimeoutMinutes: 60,
          loginAlerts: true,
          ...data.settings?.security,
        },
      });
    }
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/org/settings", form);
      toast({ title: "Settings saved" });
      await queryClient.invalidateQueries({ queryKey: ["org-settings"] });
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

  if (isLoading) {
    return (
      <DashboardLayout variant="org" title="Settings">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout variant="org" title="Settings">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>Organization preferences</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Company Name</Label>
              <Input
                value={form.general?.companyName ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    general: { ...f.general, companyName: e.target.value },
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={form.general?.timezone ?? "UTC"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    general: { ...f.general, timezone: v },
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">Eastern</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific</SelectItem>
                  <SelectItem value="Europe/London">London</SelectItem>
                  <SelectItem value="Asia/Kolkata">India</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={form.general?.language ?? "en"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    general: { ...f.general, language: v },
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Theme</Label>
              <Select
                value={form.general?.theme ?? "system"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    general: {
                      ...f.general,
                      theme: v as "light" | "dark" | "system",
                    },
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mail Settings</CardTitle>
            <CardDescription>Default mail server configuration</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>SMTP Host</Label>
              <Input
                value={form.mail?.smtpHost ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    mail: { ...f.mail, smtpHost: e.target.value },
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>SMTP Port</Label>
              <Input
                type="number"
                value={form.mail?.smtpPort ?? 587}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    mail: { ...f.mail, smtpPort: parseInt(e.target.value, 10) },
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>IMAP Port</Label>
              <Input
                type="number"
                value={form.mail?.imapPort ?? 993}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    mail: { ...f.mail, imapPort: parseInt(e.target.value, 10) },
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>POP3 Port</Label>
              <Input
                type="number"
                value={form.mail?.pop3Port ?? 995}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    mail: { ...f.mail, pop3Port: parseInt(e.target.value, 10) },
                  }))
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Default Quota (GB)</Label>
              <Input
                type="number"
                value={Math.round(
                  (form.mail?.defaultQuotaBytes ?? 5368709120) / 1073741824
                )}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    mail: {
                      ...f.mail,
                      defaultQuotaBytes:
                        parseInt(e.target.value, 10) * 1073741824,
                    },
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Password policy and session settings</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Min Password Length</Label>
              <Input
                type="number"
                value={form.security?.passwordMinLength ?? 8}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    security: {
                      ...f.security,
                      passwordMinLength: parseInt(e.target.value, 10),
                    },
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Session Timeout (minutes)</Label>
              <Input
                type="number"
                value={form.security?.sessionTimeoutMinutes ?? 60}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    security: {
                      ...f.security,
                      sessionTimeoutMinutes: parseInt(e.target.value, 10),
                    },
                  }))
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Recovery Email</Label>
              <Input
                type="email"
                value={form.security?.recoveryEmail ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    security: { ...f.security, recoveryEmail: e.target.value },
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={save} disabled={saving} className="w-full">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </DashboardLayout>
  );
}
