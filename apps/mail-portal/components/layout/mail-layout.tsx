"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { MailSidebar } from "@mail-portal/components/layout/mail-sidebar";
import { MailTopBar } from "@mail-portal/components/layout/mail-top-bar";
import { useMailDashboard } from "@mail-portal/hooks/use-mail-dashboard";
import { useMailKeyboardShortcuts } from "@mail-portal/hooks/use-mail-shortcuts";
import { useMailSettings } from "@mail-portal/hooks/use-mail-settings";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";

interface MailLayoutProps {
  children: React.ReactNode;
}

interface MailLayoutContextValue {
  registerRefresh: (handler: () => void | Promise<void>) => void;
}

const MailLayoutContext = createContext<MailLayoutContextValue | null>(null);

export function useMailLayout() {
  return useContext(MailLayoutContext);
}

export function MailLayout({ children }: MailLayoutProps) {
  const router = useRouter();
  const { data: dashboard } = useMailDashboard();
  const { data: settings } = useMailSettings();
  const [refreshHandler, setRefreshHandler] = useState<(() => void | Promise<void>) | null>(
    null
  );
  const [collapsed, setCollapsed] = useState(false);

  const sidebarWidth = settings?.sidebarWidth ?? 260;

  const registerRefresh = useCallback((handler: () => void | Promise<void>) => {
    setRefreshHandler(() => handler);
  }, []);

  useMailKeyboardShortcuts({
    onCompose: () => router.push("/mail-portal/compose"),
    onRefresh: () => refreshHandler?.(),
    onSearch: () => {
      const el = document.querySelector<HTMLInputElement>(
        'input[placeholder="Search mail (press /)"]'
      );
      el?.focus();
    },
  });

  return (
    <MailLayoutContext.Provider value={{ registerRefresh }}>
      <div className="flex h-screen overflow-hidden bg-background">
        <MailSidebar
          width={sidebarWidth}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          storageUsed={dashboard?.storageUsed}
          storageQuota={dashboard?.storageQuota}
          storagePercent={dashboard?.storagePercent}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <MailTopBar onRefresh={refreshHandler ?? undefined} />
          <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
        </div>
      </div>
    </MailLayoutContext.Provider>
  );
}

export function MailLoadingShell() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-4 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
