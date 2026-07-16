"use client";

import { useBilling } from "@/hooks/use-billing";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const ALLOWED_PATHS = ["/org/choose-plan"];

export function OrgBillingGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: billing, isLoading } = useBilling();

  const isAllowed = ALLOWED_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (isLoading || isAllowed) return;
    if (billing && !billing.canAccessDashboard) {
      router.replace("/org/choose-plan");
    }
  }, [billing, isLoading, isAllowed, router]);

  if (isLoading && !isAllowed) {
    return (
      <div className="p-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAllowed && billing && !billing.canAccessDashboard) {
    return (
      <div className="p-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return <>{children}</>;
}
