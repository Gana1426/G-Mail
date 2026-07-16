"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api.client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () =>
      api.get<{
        smtp: Record<string, unknown>;
        imap: Record<string, unknown>;
        pop3: Record<string, unknown>;
      }>("/settings"),
  });

  const [smtp, setSmtp] = useState<Record<string, unknown>>({});
  const [imap, setImap] = useState<Record<string, unknown>>({});
  const [pop3, setPop3] = useState<Record<string, unknown>>({});

  const settings = data?.data;

  useEffect(() => {
    if (settings) {
      setSmtp(settings.smtp ?? {});
      setImap(settings.imap ?? {});
      setPop3(settings.pop3 ?? {});
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.patch("/settings", payload),
    onSuccess: () => {
      toast({ title: "Settings saved" });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout variant="admin" title="Server Settings">
        <Skeleton className="h-64 w-full" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout variant="admin" title="Server Settings">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">SMTP Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Hostname</Label>
              <Input
                value={String(smtp.hostname ?? "")}
                onChange={(e) =>
                  setSmtp((s) => ({ ...s, hostname: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Input
                type="number"
                value={Number(smtp.port ?? 587)}
                onChange={(e) =>
                  setSmtp((s) => ({ ...s, port: parseInt(e.target.value, 10) }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Max Message Size (bytes)</Label>
              <Input
                type="number"
                value={Number(smtp.maxMessageSize ?? 52428800)}
                onChange={(e) =>
                  setSmtp((s) => ({
                    ...s,
                    maxMessageSize: parseInt(e.target.value, 10),
                  }))
                }
              />
            </div>
            <Button
              onClick={() => saveMutation.mutate({ smtp })}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save SMTP
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">IMAP Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Port</Label>
              <Input
                type="number"
                value={Number(imap.port ?? 993)}
                onChange={(e) =>
                  setImap((i) => ({ ...i, port: parseInt(e.target.value, 10) }))
                }
              />
            </div>
            <Button
              onClick={() => saveMutation.mutate({ imap })}
              disabled={saveMutation.isPending}
            >
              Save IMAP
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">POP3 Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Port</Label>
              <Input
                type="number"
                value={Number(pop3.port ?? 995)}
                onChange={(e) =>
                  setPop3((p) => ({ ...p, port: parseInt(e.target.value, 10) }))
                }
              />
            </div>
            <Button
              onClick={() => saveMutation.mutate({ pop3 })}
              disabled={saveMutation.isPending}
            >
              Save POP3
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
