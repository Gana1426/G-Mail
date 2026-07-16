"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/sidebar";
import { useOnboarding } from "@/hooks/use-onboarding";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Globe, Mail, Shield, ArrowRight, Rocket } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function GettingStartedPage() {
  const router = useRouter();
  const { data: onboarding, isLoading } = useOnboarding();

  useEffect(() => {
    if (onboarding?.hasVerifiedDomain) {
      router.replace("/org");
    }
  }, [onboarding, router]);

  if (isLoading) {
    return (
      <DashboardLayout variant="org" title="Getting Started">
        <Skeleton className="h-64 w-full" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout variant="org" title="Getting Started">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Rocket className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">
            Welcome to Mail Hosting
          </h2>
          <p className="text-muted-foreground mt-3 text-lg">
            Let&apos;s configure your first domain to start sending and receiving
            email.
          </p>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Step 1: Add Your Domain
            </CardTitle>
            <CardDescription>
              Add your company domain (e.g. example.com) and configure DNS records
              to verify ownership.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg">
              <Link href="/org/domains/new">
                Add Domain
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="opacity-60">
            <CardHeader>
              <Mail className="mb-2 h-6 w-6 text-muted-foreground" />
              <CardTitle className="text-base">Create Mailboxes</CardTitle>
              <CardDescription>
                Set up email accounts for your team
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="opacity-60">
            <CardHeader>
              <Shield className="mb-2 h-6 w-6 text-muted-foreground" />
              <CardTitle className="text-base">Email Security</CardTitle>
              <CardDescription>
                SPF, DKIM, and DMARC protection
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="opacity-60">
            <CardHeader>
              <Globe className="mb-2 h-6 w-6 text-muted-foreground" />
              <CardTitle className="text-base">Go Live</CardTitle>
              <CardDescription>
                Start sending and receiving email
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {onboarding?.hasDomain && !onboarding.hasVerifiedDomain && (
          <Card>
            <CardHeader>
              <CardTitle>Domain pending verification</CardTitle>
              <CardDescription>
                You have added a domain but it hasn&apos;t been verified yet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href={`/org/domains/${onboarding.domains[0]?.id}`}>
                  Continue DNS Setup
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
