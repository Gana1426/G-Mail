"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/sidebar";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
import { config } from "@/config";

export default function PortalSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    timezone: "UTC",
    language: "en",
    dateFormat: "MMM d, yyyy",
    timeFormat: "12h",
    theme: "system",
  });

  const save = () => {
    localStorage.setItem("portal-settings", JSON.stringify(settings));
    toast({ title: "Settings saved" });
  };

  return (
    <DashboardLayout variant="portal" title="Settings">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>Personalize your mail portal experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={settings.timezone}
                onValueChange={(v) =>
                  setSettings((s) => ({ ...s, timezone: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time</SelectItem>
                  <SelectItem value="America/Chicago">Central Time</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                  <SelectItem value="Asia/Kolkata">India (IST)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={settings.language}
                onValueChange={(v) =>
                  setSettings((s) => ({ ...s, language: v }))
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
                value={settings.theme}
                onValueChange={(v) =>
                  setSettings((s) => ({ ...s, theme: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={save}>Save Settings</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mail Server</CardTitle>
            <CardDescription>Connection settings for your mail client</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">IMAP Host</span>
              <span className="font-mono">{config.mail.hostname}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IMAP Port</span>
              <span>{config.mail.imapPort}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">SMTP Host</span>
              <span className="font-mono">{config.mail.hostname}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">SMTP Port</span>
              <span>{config.mail.smtpPort}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
