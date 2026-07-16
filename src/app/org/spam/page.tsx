"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/sidebar";
import { useOnboarding } from "@/hooks/use-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrgSpamPage() {
  const router = useRouter();
  const { data: onboarding } = useOnboarding();

  useEffect(() => {
    if (onboarding && !onboarding.hasVerifiedDomain) {
      router.replace("/org");
    }
  }, [onboarding, router]);

  return (
    <DashboardLayout variant="org" title="Spam">
      <Card>
        <CardHeader>
          <CardTitle>Spam Protection</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Review spam settings and quarantine for your organization.
          </p>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
