"use client";

import { DashboardLayout } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { openWebmail } from "@/lib/webmail";
import { Mail, ExternalLink } from "lucide-react";

export default function WebmailPage() {
  return (
    <DashboardLayout variant="portal" title="Webmail">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Open Webmail</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Access your inbox via Roundcube webmail with single sign-on.
          </p>
          <Button onClick={() => openWebmail()} className="w-full">
            <Mail className="mr-2 h-4 w-4" />
            Launch Webmail
            <ExternalLink className="ml-auto h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
