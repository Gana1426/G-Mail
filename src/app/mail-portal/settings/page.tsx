"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { MailLayout } from "@mail-portal/components/layout/mail-layout";
import { SignatureManager } from "@mail-portal/components/mail/signature-manager";
import { useMailSettings } from "@mail-portal/hooks/use-mail-settings";
import { useMailDashboard, useMailProfile } from "@mail-portal/hooks/use-mail-dashboard";
import { mailApi } from "@mail-portal/services/api.client";
import type { MailSettings } from "@mail-portal/types/mail";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@mail-portal/components/ui/progress";
import { formatBytes } from "@/utils";
import { cn } from "@/utils";
import {
  Loader2,
  Settings,
  User,
  PenLine,
  Mail,
  Palette,
  Bell,
  Shield,
  HardDrive,
  Keyboard,
  Info,
  UserCircle,
} from "lucide-react";

type SettingsSection =
  | "general"
  | "account"
  | "profile"
  | "signature"
  | "mail"
  | "appearance"
  | "notifications"
  | "security"
  | "storage"
  | "shortcuts"
  | "about";

const NAV: Array<{ id: SettingsSection; label: string; icon: typeof Settings }> = [
  { id: "general", label: "General", icon: Settings },
  { id: "account", label: "Account", icon: UserCircle },
  { id: "profile", label: "Profile", icon: User },
  { id: "signature", label: "Signature", icon: PenLine },
  { id: "mail", label: "Mail", icon: Mail },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "storage", label: "Storage", icon: HardDrive },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "about", label: "About", icon: Info },
];

interface NotificationPrefs {
  desktopNotifications?: boolean;
  browserNotifications?: boolean;
  notificationSound?: boolean;
  onlyIncomingMail?: boolean;
}

export default function MailSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setTheme } = useTheme();
  const { data: settings, isLoading } = useMailSettings();
  const { data: profile } = useMailProfile();
  const { data: dashboard } = useMailDashboard();
  const [section, setSection] = useState<SettingsSection>("general");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<MailSettings>>({});
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    desktopNotifications: true,
    browserNotifications: true,
    notificationSound: false,
    onlyIncomingMail: true,
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (settings) setForm({});
  }, [settings]);

  const merged = { ...settings, ...form } as MailSettings;
  const updateForm = (patch: Partial<MailSettings>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const saveSettings = async (patch: Partial<MailSettings> = form) => {
    setSaving(true);
    try {
      await mailApi.patch<MailSettings>("/settings", patch);
      if (patch.theme) setTheme(patch.theme);
      toast({ title: "Settings saved" });
      setForm({});
      await queryClient.invalidateQueries({ queryKey: ["mail-settings"] });
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

  const changePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await mailApi.post("/settings", {
        action: "changePassword",
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast({ title: "Password updated" });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      toast({
        title: "Password change failed",
        description: error instanceof Error ? error.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !settings) {
    return (
      <MailLayout>
        <div className="flex h-full gap-6 p-6">
          <Skeleton className="h-full w-52" />
          <Skeleton className="h-64 flex-1" />
        </div>
      </MailLayout>
    );
  }

  const storagePercent = dashboard?.storagePercent ?? profile?.storagePercent ?? 0;

  return (
    <MailLayout>
      <div className="flex h-full min-h-0 overflow-hidden">
        <aside className="w-56 shrink-0 border-r bg-[#faf9f8] dark:bg-muted/20">
          <div className="border-b px-4 py-4">
            <h1 className="text-lg font-semibold">Settings</h1>
          </div>
          <nav className="space-y-0.5 p-2">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors",
                  section === item.id
                    ? "bg-[#0f6cbd]/10 font-medium text-[#0f6cbd]"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-3xl space-y-4">
            {section === "general" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">General</CardTitle>
                  <CardDescription>Language, timezone, and display preferences</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Display name</Label>
                    <Input
                      value={merged.displayName ?? ""}
                      onChange={(e) => updateForm({ displayName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select value={merged.language} onValueChange={(v) => updateForm({ language: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Input value={merged.timezone} onChange={(e) => updateForm({ timezone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date format</Label>
                    <Select
                      value={merged.dateFormat}
                      onValueChange={(v) => updateForm({ dateFormat: v as MailSettings["dateFormat"] })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MMM d, yyyy">Jan 6, 2026</SelectItem>
                        <SelectItem value="dd/MM/yyyy">06/01/2026</SelectItem>
                        <SelectItem value="MM/dd/yyyy">01/06/2026</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <Select value={merged.theme} onValueChange={(v) => updateForm({ theme: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">System</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Button disabled={saving} onClick={() => saveSettings()}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {section === "account" && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Vacation reply</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={merged.vacationEnabled}
                        onChange={(e) => updateForm({ vacationEnabled: e.target.checked })}
                      />
                      Enable vacation auto-reply
                    </label>
                    <Input
                      placeholder="Subject"
                      value={merged.vacationSubject ?? ""}
                      onChange={(e) => updateForm({ vacationSubject: e.target.value })}
                    />
                    <textarea
                      className="min-h-[100px] w-full rounded-md border p-3 text-sm"
                      placeholder="Auto-reply message"
                      value={merged.vacationMessage ?? ""}
                      onChange={(e) => updateForm({ vacationMessage: e.target.value })}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Forwarding</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={merged.forwardingEnabled}
                        onChange={(e) => updateForm({ forwardingEnabled: e.target.checked })}
                      />
                      Enable forwarding
                    </label>
                    <Input
                      placeholder="Forward to email"
                      value={merged.forwardingAddress ?? ""}
                      onChange={(e) => updateForm({ forwardingAddress: e.target.value })}
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={merged.keepCopy}
                        onChange={(e) => updateForm({ keepCopy: e.target.checked })}
                      />
                      Keep a copy in this mailbox
                    </label>
                  </CardContent>
                </Card>
                <Button disabled={saving} onClick={() => saveSettings()}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save account settings
                </Button>
              </>
            )}

            {section === "profile" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Profile</CardTitle>
                  <CardDescription>Manage your name, avatar, and contact details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {profile?.displayName ?? profile?.email}
                  </p>
                  <p className="text-sm text-muted-foreground">{profile?.email}</p>
                  <Button asChild variant="outline">
                    <Link href="/mail-portal/profile">Open profile page</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {section === "signature" && <SignatureManager settings={merged} />}

            {section === "mail" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Mail</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Default reply mode</Label>
                    <Select
                      value={merged.defaultReplyMode}
                      onValueChange={(v) =>
                        updateForm({ defaultReplyMode: v as MailSettings["defaultReplyMode"] })
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reply">Reply</SelectItem>
                        <SelectItem value="replyAll">Reply all</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Auto-save draft interval (seconds)</Label>
                    <Input
                      type="number"
                      min={10}
                      value={merged.autoSaveDraftInterval}
                      onChange={(e) =>
                        updateForm({ autoSaveDraftInterval: parseInt(e.target.value, 10) || 30 })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-3 text-sm md:col-span-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={merged.autoSaveDraft}
                        onChange={(e) => updateForm({ autoSaveDraft: e.target.checked })}
                      />
                      Auto-save drafts while composing
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={merged.readReceiptsDefault}
                        onChange={(e) => updateForm({ readReceiptsDefault: e.target.checked })}
                      />
                      Request read receipts by default
                    </label>
                  </div>
                  <div className="md:col-span-2">
                    <Button disabled={saving} onClick={() => saveSettings()}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {section === "appearance" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Appearance</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <Select value={merged.theme} onValueChange={(v) => updateForm({ theme: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">System</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Message density</Label>
                    <Select
                      value={merged.messageDensity}
                      onValueChange={(v) =>
                        updateForm({ messageDensity: v as MailSettings["messageDensity"] })
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compact">Compact</SelectItem>
                        <SelectItem value="comfortable">Comfortable</SelectItem>
                        <SelectItem value="spacious">Spacious</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reading pane</Label>
                    <Select
                      value={merged.previewPane}
                      onValueChange={(v) =>
                        updateForm({ previewPane: v as MailSettings["previewPane"] })
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="right">Right</SelectItem>
                        <SelectItem value="bottom">Bottom</SelectItem>
                        <SelectItem value="off">Off</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={merged.conversationView}
                        onChange={(e) => updateForm({ conversationView: e.target.checked })}
                      />
                      Conversation view
                    </label>
                  </div>
                  <div className="md:col-span-2">
                    <Button disabled={saving} onClick={() => saveSettings()}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {section === "notifications" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notifications</CardTitle>
                  <CardDescription>Only new incoming mail generates notifications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={notifPrefs.desktopNotifications}
                      onChange={(e) =>
                        setNotifPrefs((p) => ({ ...p, desktopNotifications: e.target.checked }))
                      }
                    />
                    Desktop notifications
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={notifPrefs.browserNotifications}
                      onChange={(e) =>
                        setNotifPrefs((p) => ({ ...p, browserNotifications: e.target.checked }))
                      }
                    />
                    Browser notifications
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={notifPrefs.notificationSound}
                      onChange={(e) =>
                        setNotifPrefs((p) => ({ ...p, notificationSound: e.target.checked }))
                      }
                    />
                    Notification sound
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" checked readOnly disabled />
                    Only notify for new incoming mail
                  </label>
                  <Button
                    onClick={() => toast({ title: "Notification preferences saved" })}
                  >
                    Save
                  </Button>
                </CardContent>
              </Card>
            )}

            {section === "security" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Security</CardTitle>
                  <CardDescription>Change your mailbox password</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <PasswordInput
                    placeholder="Current password"
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))
                    }
                  />
                  <PasswordInput
                    placeholder="New password"
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))
                    }
                  />
                  <PasswordInput
                    placeholder="Confirm new password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))
                    }
                  />
                  <Button onClick={changePassword} disabled={saving}>
                    Update password
                  </Button>
                  <Button asChild variant="outline" className="ml-2">
                    <Link href="/mail-portal/profile">Two-factor & sessions</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {section === "storage" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Storage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span>Used</span>
                    <span>
                      {formatBytes(BigInt(dashboard?.storageUsed ?? profile?.storageUsed ?? "0"))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Quota</span>
                    <span>
                      {formatBytes(BigInt(dashboard?.storageQuota ?? profile?.storageQuota ?? "0"))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Remaining</span>
                    <span>
                      {formatBytes(
                        BigInt(dashboard?.storageQuota ?? profile?.storageQuota ?? "0") -
                          BigInt(dashboard?.storageUsed ?? profile?.storageUsed ?? "0")
                      )}
                    </span>
                  </div>
                  <Progress value={storagePercent} className="h-2" />
                  <p className="text-xs text-muted-foreground">{storagePercent}% used</p>
                </CardContent>
              </Card>
            )}

            {section === "shortcuts" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Keyboard shortcuts</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-3 text-sm">
                    {[
                      ["/", "Focus search"],
                      ["C", "Compose new mail"],
                      ["R", "Refresh"],
                    ].map(([key, desc]) => (
                      <div key={key} className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">{desc}</dt>
                        <dd className="font-mono text-xs">{key}</dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            )}

            {section === "about" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">About Mail Portal</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>MailHost Webmail — secure business email for your organization.</p>
                  <p>Version 1.0.0</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MailLayout>
  );
}
