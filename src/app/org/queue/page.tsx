"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/sidebar";
import { useOnboarding } from "@/hooks/use-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrgQueuePage() {
  const router = useRouter();
  const { data: onboarding } = useOnboarding();

  useEffect(() => {
    if (onboarding && !onboarding.hasVerifiedDomain) {
      router.replace("/org");
    }
  }, [onboarding, router]);

  return (
    <DashboardLayout variant="org" title="Queue">
      <Card>
        <CardHeader>
          <CardTitle>Mail Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Monitor incoming and outgoing mail queue status.
          </p>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
