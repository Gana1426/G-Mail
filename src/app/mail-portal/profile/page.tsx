"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MailLayout } from "@mail-portal/components/layout/mail-layout";
import { MailAvatar } from "@mail-portal/components/mail/mail-avatar";
import { mailApi } from "@mail-portal/services/api.client";
import type { MailProfile } from "@mail-portal/types/mail";
import { formatBytes, formatDateTime } from "@/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@mail-portal/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Shield, Upload } from "lucide-react";

export default function MailProfilePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaSetup, setTwoFaSetup] = useState<{ secret: string; qrCodeUrl: string } | null>(
    null
  );
  const [form, setForm] = useState({
    displayName: "",
    firstName: "",
    lastName: "",
    phone: "",
    timezone: "UTC",
    language: "en",
    avatar: null as string | null,
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const { data: profile, isLoading } = useQuery({
    queryKey: ["mail-profile"],
    queryFn: async () => {
      const res = await mailApi.get<MailProfile>("/profile");
      return res.data!;
    },
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      displayName: profile.displayName ?? "",
      firstName: profile.firstName ?? "",
      lastName: profile.lastName ?? "",
      phone: profile.phone ?? "",
      timezone: profile.timezone,
      language: profile.language,
      avatar: profile.avatar,
    });
  }, [profile]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await mailApi.patch("/profile", form);
      toast({ title: "Profile updated" });
      await queryClient.invalidateQueries({ queryKey: ["mail-profile"] });
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatar = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Image must be under 2 MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, avatar: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const revokeSession = async (sessionId: string) => {
    try {
      await mailApi.delete(`/profile?sessionId=${encodeURIComponent(sessionId)}`);
      toast({ title: "Session revoked" });
      await queryClient.invalidateQueries({ queryKey: ["mail-profile"] });
    } catch (error) {
      toast({
        title: "Failed to revoke session",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  const setup2FA = async () => {
    setTwoFaLoading(true);
    try {
      const res = await mailApi.get<{ secret: string; qrCodeUrl: string }>("/profile/2fa");
      setTwoFaSetup(res.data ?? null);
    } catch (error) {
      toast({
        title: "2FA setup failed",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setTwoFaLoading(false);
    }
  };

  const enable2FA = async () => {
    setTwoFaLoading(true);
    try {
      await mailApi.post("/profile/2fa", { action: "enable", code: twoFaCode });
      toast({ title: "2FA enabled" });
      setTwoFaSetup(null);
      setTwoFaCode("");
      await queryClient.invalidateQueries({ queryKey: ["mail-profile"] });
    } catch (error) {
      toast({
        title: "Enable failed",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setTwoFaLoading(false);
    }
  };

  const disable2FA = async () => {
    setTwoFaLoading(true);
    try {
      await mailApi.post("/profile/2fa", { action: "disable", code: twoFaCode });
      toast({ title: "2FA disabled" });
      setTwoFaCode("");
      await queryClient.invalidateQueries({ queryKey: ["mail-profile"] });
    } catch (error) {
      toast({
        title: "Disable failed",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setTwoFaLoading(false);
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
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <MailLayout>
      <div className="flex-1 overflow-y-auto p-6">
        <h1 className="mb-6 text-2xl font-semibold">Profile</h1>

        {isLoading ? (
          <Skeleton className="h-64 w-full max-w-2xl" />
        ) : (
          <div className="grid max-w-3xl gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <MailAvatar
                    name={form.displayName || profile?.email}
                    email={profile?.email}
                    avatarUrl={form.avatar}
                    size="lg"
                  />
                  <div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAvatar(file);
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload avatar
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Display name</Label>
                    <Input
                      value={form.displayName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, displayName: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={profile?.email ?? ""} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>First name</Label>
                    <Input
                      value={form.firstName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, firstName: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last name</Label>
                    <Input
                      value={form.lastName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, lastName: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Input
                      value={form.timezone}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, timezone: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Input
                      value={form.language}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, language: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <Button onClick={saveProfile} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save profile
                </Button>

                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span>Storage used</span>
                    <span>
                      {formatBytes(BigInt(profile?.storageUsed ?? "0"))} /{" "}
                      {formatBytes(BigInt(profile?.storageQuota ?? "0"))}
                    </span>
                  </div>
                  <Progress value={profile?.storagePercent ?? 0} />
                </div>
                {profile?.lastLoginAt && (
                  <p className="text-sm text-muted-foreground">
                    Last login: {formatDateTime(profile.lastLoginAt)}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Security</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Two-factor authentication</p>
                        <p className="text-xs text-muted-foreground">
                          {profile?.twoFactorEnabled ? "Enabled" : "Not enabled"}
                        </p>
                      </div>
                    </div>
                    <Badge variant={profile?.twoFactorEnabled ? "default" : "secondary"}>
                      {profile?.twoFactorEnabled ? "On" : "Off"}
                    </Badge>
                  </div>

                  {!profile?.twoFactorEnabled && !twoFaSetup && (
                    <Button onClick={setup2FA} disabled={twoFaLoading} size="sm">
                      {twoFaLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Set up 2FA
                    </Button>
                  )}

                  {twoFaSetup && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Enter this secret in your authenticator app:
                      </p>
                      <code className="block rounded bg-muted p-2 text-xs break-all">
                        {twoFaSetup.secret}
                      </code>
                      <Input
                        value={twoFaCode}
                        onChange={(e) => setTwoFaCode(e.target.value)}
                        placeholder="6-digit verification code"
                      />
                      <Button onClick={enable2FA} disabled={twoFaLoading || !twoFaCode} size="sm">
                        Enable 2FA
                      </Button>
                    </div>
                  )}

                  {profile?.twoFactorEnabled && (
                    <div className="space-y-2">
                      <Input
                        value={twoFaCode}
                        onChange={(e) => setTwoFaCode(e.target.value)}
                        placeholder="6-digit code to disable"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={disable2FA}
                        disabled={twoFaLoading || !twoFaCode}
                      >
                        Disable 2FA
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Change password</Label>
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
                    placeholder="Confirm password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))
                    }
                  />
                  <Button variant="outline" onClick={changePassword} disabled={saving}>
                    Update password
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Active sessions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {profile?.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {session.deviceInfo ?? "Unknown device"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {session.ipAddress ?? "Unknown IP"} ·{" "}
                        {formatDateTime(session.lastActiveAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {session.current ? (
                        <Badge>Current</Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => revokeSession(session.id)}
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {profile?.loginHistory && profile.loginHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Login history</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {profile.loginHistory.map((entry, i) => (
                    <div key={`${entry.at}-${i}`} className="text-sm text-muted-foreground">
                      {formatDateTime(entry.at)} · {entry.device ?? "Unknown"} ·{" "}
                      {entry.ip ?? "—"}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </MailLayout>
  );
}
