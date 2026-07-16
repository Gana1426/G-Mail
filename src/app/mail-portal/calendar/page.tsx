"use client";

import { MailLayout } from "@mail-portal/components/layout/mail-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export default function MailCalendarPage() {
  return (
    <MailLayout>
      <div className="flex-1 overflow-y-auto p-6">
        <h1 className="mb-6 text-2xl font-semibold">Calendar</h1>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              Events & invitations
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Calendar integration is reserved for a future expansion. Create events,
            send invitations, and manage schedules from this module when enabled.
          </CardContent>
        </Card>
      </div>
    </MailLayout>
  );
}
