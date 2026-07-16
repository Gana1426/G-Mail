"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/sidebar";
import { useAuthStore } from "@/hooks/use-store";
import { api } from "@/services/api.client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { formatDateTime } from "@/utils";

interface Session {
  id: string;
  deviceInfo: string | null;
  ipAddress: string | null;
  lastActiveAt: string;
}

export default function PortalProfilePage() {
  const { user, setUser } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
  });
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const { data: sessions } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const res = await api.get<Session[]>("/auth/sessions");
      return res.data ?? [];
    },
  });

  useEffect(() => {
    if (user) {
      setProfile({ firstName: user.firstName, lastName: user.lastName });
    }
  }, [user]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.patch("/profile", profile);
      if (user) setUser({ ...user, ...profile });
      toast({ title: "Profile updated" });
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

  const changePassword = async () => {
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.post("/auth/2fa", {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      toast({ title: "Password changed" });
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
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

  const revokeSession = async (sessionId: string) => {
    try {
      await api.delete(`/auth/sessions?sessionId=${sessionId}`);
      toast({ title: "Session revoked" });
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    } catch {
      toast({ title: "Failed to revoke session", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout variant="portal" title="Profile">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                {profile.firstName?.[0]}
                {profile.lastName?.[0]}
              </div>
              <div>
                <p className="font-medium">
                  {profile.firstName} {profile.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  value={profile.firstName}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, firstName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  value={profile.lastName}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, lastName: e.target.value }))
                  }
                />
              </div>
            </div>
            <Button onClick={saveProfile} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Profile
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <PasswordInput
                value={passwords.currentPassword}
                onChange={(e) =>
                  setPasswords((p) => ({
                    ...p,
                    currentPassword: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>New Password</Label>
                <PasswordInput
                  value={passwords.newPassword}
                  onChange={(e) =>
                    setPasswords((p) => ({ ...p, newPassword: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <PasswordInput
                  value={passwords.confirmPassword}
                  onChange={(e) =>
                    setPasswords((p) => ({
                      ...p,
                      confirmPassword: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <Button variant="outline" onClick={changePassword} disabled={saving}>
              Change Password
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions?.length === 0 && (
              <p className="text-sm text-muted-foreground">No active sessions</p>
            )}
            {sessions?.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {s.deviceInfo ?? "Unknown device"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.ipAddress ?? "—"} · Last active{" "}
                    {formatDateTime(s.lastActiveAt)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => revokeSession(s.id)}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
