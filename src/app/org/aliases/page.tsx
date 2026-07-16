"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/sidebar";
import { useOnboarding } from "@/hooks/use-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function LockedFeaturePage({ title }: { title: string }) {
  const router = useRouter();
  const { data: onboarding } = useOnboarding();

  useEffect(() => {
    if (onboarding && !onboarding.hasVerifiedDomain) {
      router.replace("/org");
    }
  }, [onboarding, router]);

  return (
    <DashboardLayout variant="org" title={title}>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {title} management is available after domain verification.
          </p>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

export default function OrgAliasesPage() {
  return <LockedFeaturePage title="Aliases" />;
}
