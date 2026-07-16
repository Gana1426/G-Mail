"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/sidebar";
import { useOnboarding } from "@/hooks/use-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrgGroupsPage() {
  const router = useRouter();
  const { data: onboarding } = useOnboarding();

  useEffect(() => {
    if (onboarding && !onboarding.hasVerifiedDomain) {
      router.replace("/org");
    }
  }, [onboarding, router]);

  return (
    <DashboardLayout variant="org" title="Groups">
      <Card>
        <CardHeader>
          <CardTitle>Distribution Groups</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Manage distribution lists and group mailboxes.
          </p>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
