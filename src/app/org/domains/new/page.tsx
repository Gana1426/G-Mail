"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createDomainSchema } from "@/utils/validation";
import { z } from "zod";
import { DashboardLayout } from "@/components/layout/sidebar";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlanLimitBanner, PlanUsageCard } from "@/components/org/plan-usage-card";
import { UpgradePlanDialog } from "@/components/org/upgrade-plan-dialog";
import { usePlanUsage, invalidatePlanUsage } from "@/hooks/use-plan-usage";
import { PLAN_LIMIT_MESSAGES } from "@/types/plan-usage";
import { Loader2, Globe, ArrowUpCircle } from "lucide-react";

type FormInput = z.infer<typeof createDomainSchema>;

export default function AddDomainPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: planUsage } = usePlanUsage();
  const [loading, setLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const domainLimitReached = planUsage?.domains.atLimit ?? false;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(createDomainSchema),
  });

  useEffect(() => {
    if (domainLimitReached) {
      setShowUpgrade(true);
    }
  }, [domainLimitReached]);

  const onSubmit = async (data: FormInput) => {
    if (domainLimitReached) {
      setShowUpgrade(true);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!response.ok) {
        if (result.code === "PLAN_LIMIT") {
          setShowUpgrade(true);
        }
        throw new Error(result.error ?? "Failed to add domain");
      }

      toast({
        title: "Domain added",
        description: "Configure DNS records to verify your domain",
      });

      await invalidatePlanUsage(queryClient);
      router.push(`/org/domains/${result.data.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Could not add domain",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout
      variant="org"
      title="Add Domain"
      breadcrumbs={[
        { label: "Domains", href: "/org/domains" },
        { label: "Add Domain" },
      ]}
    >
      <div className="mx-auto max-w-2xl space-y-6">
        {domainLimitReached && (
          <PlanLimitBanner
            message={PLAN_LIMIT_MESSAGES.domain}
            onUpgrade={() => setShowUpgrade(true)}
          />
        )}

        <PlanUsageCard compact />

        <Card>
          <CardHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Add your domain</CardTitle>
            <CardDescription>
              Enter the domain name you want to use for email hosting. You will
              need access to your domain&apos;s DNS settings.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Domain Name</Label>
                <Input
                  id="name"
                  placeholder="example.com"
                  disabled={domainLimitReached}
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">
                    {errors.name.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Enter without www or http://
                </p>
              </div>

              {domainLimitReached ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={() => setShowUpgrade(true)}
                  >
                    <ArrowUpCircle className="mr-2 h-4 w-4" />
                    Upgrade Plan
                  </Button>
                  <Button type="button" variant="outline" className="flex-1" disabled>
                    Generate DNS Records
                  </Button>
                </div>
              ) : (
                <Button type="submit" disabled={loading} className="w-full">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Generate DNS Records
                </Button>
              )}
            </CardContent>
          </form>
        </Card>
      </div>

      <UpgradePlanDialog open={showUpgrade} onOpenChange={setShowUpgrade} />
    </DashboardLayout>
  );
}
