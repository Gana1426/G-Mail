"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createMailboxSchema, type CreateMailboxInput } from "@/utils/validation";
import { DashboardLayout } from "@/components/layout/sidebar";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api.client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Mail, CheckCircle2, ArrowUpCircle } from "lucide-react";
import { useDebouncedCallback } from "@/hooks/use-debounce";
import { PlanLimitBanner, PlanUsageCard } from "@/components/org/plan-usage-card";
import { UpgradePlanDialog } from "@/components/org/upgrade-plan-dialog";
import { usePlanUsage, invalidatePlanUsage } from "@/hooks/use-plan-usage";
import { PLAN_LIMIT_MESSAGES } from "@/types/plan-usage";

interface VerifiedDomain {
  id: string;
  name: string;
  status: string;
  isDefault: boolean;
}

const QUOTA_OPTIONS = [
  { label: "1 GB", bytes: 1 * 1024 * 1024 * 1024 },
  { label: "2 GB", bytes: 2 * 1024 * 1024 * 1024 },
  { label: "5 GB", bytes: 5 * 1024 * 1024 * 1024 },
  { label: "10 GB", bytes: 10 * 1024 * 1024 * 1024 },
  { label: "25 GB", bytes: 25 * 1024 * 1024 * 1024 },
  { label: "50 GB", bytes: 50 * 1024 * 1024 * 1024 },
];

export default function CreateMailboxPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: onboarding } = useOnboarding();
  const { data: planUsage } = usePlanUsage(!!onboarding?.hasVerifiedDomain);
  const [loading, setLoading] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const mailboxLimitReached = planUsage?.mailboxes.atLimit ?? false;

  const { data: verifiedDomains } = useQuery({
    queryKey: ["verified-domains"],
    queryFn: async () => {
      const res = await api.get<VerifiedDomain[]>("/domains/verified");
      return res.data ?? [];
    },
    enabled: !!onboarding?.hasVerifiedDomain,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateMailboxInput>({
    resolver: zodResolver(createMailboxSchema),
    defaultValues: {
      role: "MAIL_USER",
      status: "ACTIVE",
      quotaBytes: 5 * 1024 * 1024 * 1024,
      createUser: true,
    },
  });

  const localPart = watch("localPart");
  const domainId = watch("domainId");
  const selectedDomain = verifiedDomains?.find((d) => d.id === domainId);
  const previewEmail =
    localPart && selectedDomain
      ? `${localPart.toLowerCase()}@${selectedDomain.name}`
      : "";

  useEffect(() => {
    if (onboarding && !onboarding.hasVerifiedDomain) {
      router.replace("/org");
    }
  }, [onboarding, router]);

  useEffect(() => {
    if (verifiedDomains?.length && !domainId) {
      const defaultDomain =
        verifiedDomains.find((d) => d.isDefault) ?? verifiedDomains[0];
      setValue("domainId", defaultDomain.id);
    }
  }, [verifiedDomains, domainId, setValue]);

  const checkEmail = useDebouncedCallback(async (email: string) => {
    if (!email.includes("@")) return;
    setCheckingEmail(true);
    try {
      const res = await api.post<{ available: boolean }>(
        "/mailboxes/check-email",
        { email }
      );
      setEmailAvailable(res.data?.available ?? false);
    } catch {
      setEmailAvailable(null);
    } finally {
      setCheckingEmail(false);
    }
  }, 400);

  useEffect(() => {
    if (previewEmail) {
      checkEmail(previewEmail);
    } else {
      setEmailAvailable(null);
    }
  }, [previewEmail, checkEmail]);

  useEffect(() => {
    if (mailboxLimitReached) {
      setShowUpgrade(true);
    }
  }, [mailboxLimitReached]);

  const onSubmit = async (data: CreateMailboxInput) => {
    if (mailboxLimitReached) {
      setShowUpgrade(true);
      return;
    }

    if (emailAvailable === false) {
      toast({
        title: "Mailbox exists",
        description: "This mailbox already exists.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/mailboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, createUser: true }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.code === "PLAN_LIMIT") {
          setShowUpgrade(true);
        }
        throw new Error(result.error ?? "Failed to create mailbox");
      }

      toast({
        title: "Mailbox created",
        description: `${previewEmail} is ready for SMTP, IMAP, and POP3`,
      });
      await queryClient.invalidateQueries({ queryKey: ["org-mailboxes"] });
      await invalidatePlanUsage(queryClient);
      router.push("/org/mailboxes");
    } catch (error) {
      toast({
        title: "Creation failed",
        description:
          error instanceof Error ? error.message : "Could not create mailbox",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout
      variant="org"
      title="Create Mailbox"
      breadcrumbs={[
        { label: "Mailboxes", href: "/org/mailboxes" },
        { label: "Create" },
      ]}
    >
      <div className="mx-auto max-w-2xl space-y-6">
        {mailboxLimitReached && (
          <PlanLimitBanner
            message={PLAN_LIMIT_MESSAGES.mailbox}
            onUpgrade={() => setShowUpgrade(true)}
          />
        )}

        <PlanUsageCard compact />

        <Card>
          <CardHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>New mailbox</CardTitle>
            <CardDescription>
              Create an email account on a verified domain
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" {...register("firstName")} />
                  {errors.firstName && (
                    <p className="text-sm text-destructive">
                      {errors.firstName.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" {...register("lastName")} />
                  {errors.lastName && (
                    <p className="text-sm text-destructive">
                      {errors.lastName.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name (optional)</Label>
                <Input
                  id="displayName"
                  placeholder="John Doe"
                  {...register("displayName")}
                />
              </div>

              <div className="space-y-2">
                <Label>Domain</Label>
                <Select
                  value={domainId}
                  onValueChange={(v) => setValue("domainId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select verified domain" />
                  </SelectTrigger>
                  <SelectContent>
                    {verifiedDomains?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        ✔ {d.name}
                        {d.isDefault ? " (Default)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.domainId && (
                  <p className="text-sm text-destructive">
                    {errors.domainId.message}
                  </p>
                )}
                {verifiedDomains?.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No verified domains. Verify a domain first.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="localPart">Username</Label>
                <Input
                  id="localPart"
                  placeholder="admin"
                  {...register("localPart")}
                />
                {errors.localPart && (
                  <p className="text-sm text-destructive">
                    {errors.localPart.message}
                  </p>
                )}
                {previewEmail && (
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                    <Mail className="h-4 w-4 text-primary" />
                    <span className="font-mono text-sm">{previewEmail}</span>
                    {checkingEmail && (
                      <Loader2 className="ml-auto h-4 w-4 animate-spin" />
                    )}
                    {!checkingEmail && emailAvailable === true && (
                      <CheckCircle2 className="ml-auto h-4 w-4 text-green-500" />
                    )}
                    {!checkingEmail && emailAvailable === false && (
                      <span className="ml-auto text-xs text-destructive">
                        This mailbox already exists.
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
                    {...register("password")}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">
                      {errors.password.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <PasswordInput
                    id="confirmPassword"
                    {...register("confirmPassword")}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Mailbox Size</Label>
                  <Select
                    defaultValue={String(5 * 1024 * 1024 * 1024)}
                    onValueChange={(v) =>
                      setValue("quotaBytes", parseInt(v, 10))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUOTA_OPTIONS.map((q) => (
                        <SelectItem key={q.bytes} value={String(q.bytes)}>
                          {q.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    defaultValue="MAIL_USER"
                    onValueChange={(v) =>
                      setValue("role", v as "MAIL_USER" | "ORG_ADMIN")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MAIL_USER">Mail User</SelectItem>
                      <SelectItem value="ORG_ADMIN">Org Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    defaultValue="ACTIVE"
                    onValueChange={(v) =>
                      setValue("status", v as "ACTIVE" | "SUSPENDED" | "PENDING")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="SUSPENDED">Suspended</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={
                  loading ||
                  emailAvailable === false ||
                  !verifiedDomains?.length ||
                  mailboxLimitReached
                }
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Mailbox
              </Button>

              {mailboxLimitReached && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowUpgrade(true)}
                >
                  <ArrowUpCircle className="mr-2 h-4 w-4" />
                  Upgrade Plan
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
