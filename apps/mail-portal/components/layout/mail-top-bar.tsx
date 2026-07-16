"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@mail-portal/components/layout/global-search";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { invalidateMailQueries, useMailProfile } from "@mail-portal/hooks/use-mail-dashboard";
import { NotificationCenter } from "@mail-portal/components/layout/notification-center";
import { MailAvatar } from "@mail-portal/components/mail/mail-avatar";
import {
  Moon,
  PenSquare,
  RefreshCw,
  Settings,
  Sun,
  User,
} from "lucide-react";
import { cn } from "@/utils";

interface MailTopBarProps {
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
}

export function MailTopBar({ onRefresh, refreshing }: MailTopBarProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const { data: profile } = useMailProfile();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await invalidateMailQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["mail-search"] });
      await onRefresh?.();
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, queryClient]);

  const spin = refreshing || isRefreshing;

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-[#f3f2f1] px-3 dark:bg-muted/40">
      <Button
        size="sm"
        className="h-8 gap-1.5 rounded-md bg-[#0f6cbd] px-3 text-white hover:bg-[#0f6cbd]/90"
        onClick={() => router.push("/mail-portal/compose")}
      >
        <PenSquare className="h-4 w-4" />
        New mail
      </Button>

      <GlobalSearch />

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleRefresh}
          disabled={spin}
          title="Refresh"
        >
          <RefreshCw className={cn("h-4 w-4", spin && "animate-spin")} />
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Settings">
          <Link href="/mail-portal/settings">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>

        <NotificationCenter />

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-1 flex items-center gap-2 rounded-full p-0.5 hover:bg-muted"
            >
              <MailAvatar
                name={profile?.displayName ?? undefined}
                email={profile?.email}
                avatarUrl={profile?.avatar}
                size="sm"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-2">
              <p className="text-sm font-medium">
                {profile?.displayName ?? profile?.email}
              </p>
              <p className="text-xs text-muted-foreground">{profile?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/mail-portal/profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/mail-portal/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
