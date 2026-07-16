"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/sidebar";
import { api } from "@/services/api.client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Shield } from "lucide-react";

export default function PortalSecurityPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [setupData, setSetupData] = useState<{
    secret: string;
    qrCodeUrl: string;
  } | null>(null);

  const { data: profile, refetch } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await api.get<{ twoFactorEnabled?: boolean }>("/profile");
      return res.data;
    },
  });

  const setup2FA = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ secret: string; qrCodeUrl: string }>(
        "/auth/2fa"
      );
      setSetupData(res.data ?? null);
    } catch (error) {
      toast({
        title: "Setup failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const enable2FA = async () => {
    setLoading(true);
    try {
      await api.post("/auth/2fa", { action: "enable", code });
      toast({ title: "2FA enabled" });
      setSetupData(null);
      setCode("");
      await refetch();
    } catch (error) {
      toast({
        title: "Enable failed",
        description: error instanceof Error ? error.message : "Invalid code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const disable2FA = async () => {
    setLoading(true);
    try {
      await api.post("/auth/2fa", { action: "disable", code });
      toast({ title: "2FA disabled" });
      setCode("");
      await refetch();
    } catch (error) {
      toast({
        title: "Disable failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout variant="portal" title="Security">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Two-Factor Authentication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {profile?.twoFactorEnabled
                ? "Two-factor authentication is currently enabled on your account."
                : "Add an extra layer of security to your account with 2FA."}
            </p>

            {!profile?.twoFactorEnabled && !setupData && (
              <Button onClick={setup2FA} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Set Up 2FA
              </Button>
            )}

            {setupData && (
              <div className="space-y-4">
                <p className="text-sm">
                  Scan this QR code with your authenticator app, or enter the
                  secret manually:
                </p>
                <code className="block rounded bg-muted p-2 text-xs break-all">
                  {setupData.secret}
                </code>
                <div className="space-y-2">
                  <Label>Verification Code</Label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="6-digit code"
                  />
                </div>
                <Button onClick={enable2FA} disabled={loading || !code}>
                  Enable 2FA
                </Button>
              </div>
            )}

            {profile?.twoFactorEnabled && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Verification Code</Label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="6-digit code to disable"
                  />
                </div>
                <Button
                  variant="destructive"
                  onClick={disable2FA}
                  disabled={loading || !code}
                >
                  Disable 2FA
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
