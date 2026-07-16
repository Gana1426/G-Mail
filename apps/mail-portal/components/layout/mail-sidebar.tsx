"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn, formatBytes } from "@/utils";
import { useMailFolders } from "@mail-portal/hooks/use-mail-dashboard";
import { listSidebarFolders, getFolderLabel } from "@mail-portal/lib/folders";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@mail-portal/components/ui/progress";
import type { MailFolderId } from "@mail-portal/types/mail";
import {
  Inbox,
  Send,
  FileText,
  AlertOctagon,
  Trash2,
  Archive,
  Star,
  Flag,
  SendHorizontal,
  Settings,
  User,
  LogOut,
  PenSquare,
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Folder,
} from "lucide-react";
import { useEffect, useState } from "react";
import { mailApi } from "@mail-portal/services/api.client";

const FOLDER_ICONS: Record<MailFolderId, typeof Inbox> = {
  INBOX: Inbox,
  SENT: Send,
  DRAFTS: FileText,
  ARCHIVE: Archive,
  SPAM: AlertOctagon,
  TRASH: Trash2,
  STARRED: Star,
  IMPORTANT: Flag,
  OUTBOX: SendHorizontal,
};

const CUSTOM_FOLDERS_KEY = "mail-portal-custom-folders";

interface MailSidebarProps {
  width: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  storageUsed?: string;
  storageQuota?: string;
  storagePercent?: number;
}

export function MailSidebar({
  width,
  collapsed,
  onToggleCollapse,
  storageUsed,
  storageQuota,
  storagePercent = 0,
}: MailSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: folders } = useMailFolders();
  const [customFolders, setCustomFolders] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_FOLDERS_KEY);
      if (raw) setCustomFolders(JSON.parse(raw) as string[]);
    } catch {
      setCustomFolders([]);
    }
  }, []);

  const navItems = listSidebarFolders().map((id) => ({
    id,
    label: getFolderLabel(id),
    href: `/mail-portal/mail/${id.toLowerCase()}`,
    icon: FOLDER_ICONS[id],
  }));

  const getUnread = (id: MailFolderId) =>
    folders?.find((f) => f.id === id)?.unread ?? 0;

  const handleLogout = async () => {
    await mailApi.post("/logout");
    router.push("/mail-portal/login");
  };

  return (
    <aside
      className="flex h-full flex-col border-r bg-[hsl(var(--sidebar-background))] transition-all duration-200"
      style={{ width: collapsed ? 64 : width }}
    >
      <div className="flex items-center justify-between border-b p-3">
        {!collapsed && (
          <Link href="/mail-portal" className="flex items-center gap-2 font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              M
            </div>
            <span>MailHost</span>
          </Link>
        )}
        <Button variant="ghost" size="icon" onClick={onToggleCollapse}>
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <div className="p-3">
        <Button
          className={cn("w-full shadow-sm", collapsed && "px-0")}
          onClick={() => router.push("/mail-portal/compose")}
        >
          <PenSquare className={cn("h-4 w-4", !collapsed && "mr-2")} />
          {!collapsed && "Compose"}
        </Button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          const unread = getUnread(item.id);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {unread > 0 && (
                    <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5">
                      {unread}
                    </Badge>
                  )}
                </>
              )}
            </Link>
          );
        })}

        {!collapsed && (
          <p className="px-3 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Custom folders
          </p>
        )}
        {!collapsed &&
          (customFolders.length > 0 ? (
            customFolders.map((name) => (
              <div
                key={name}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground"
              >
                <Folder className="h-4 w-4 shrink-0" />
                <span className="truncate">{name}</span>
              </div>
            ))
          ) : (
            <p className="px-3 py-2 text-xs text-muted-foreground">No custom folders yet</p>
          ))}

        {!collapsed && (
          <p className="px-3 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            More
          </p>
        )}
        {[
          { href: "/mail-portal/contacts", label: "Contacts", icon: Users },
          { href: "/mail-portal/search", label: "Search", icon: Search },
          { href: "/mail-portal/calendar", label: "Calendar", icon: Calendar },
          { href: "/mail-portal/settings", label: "Settings", icon: Settings },
          { href: "/mail-portal/profile", label: "Profile", icon: User },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                pathname.startsWith(item.href) && "bg-muted font-medium text-foreground"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {!collapsed && storageUsed && storageQuota && (
        <div className="border-t p-3">
          <div className="mb-2 flex justify-between text-xs text-muted-foreground">
            <span>Storage</span>
            <span>
              {formatBytes(BigInt(storageUsed))} / {formatBytes(BigInt(storageQuota))}
            </span>
          </div>
          <Progress value={storagePercent} className="h-1.5" />
        </div>
      )}

      <div className="border-t p-2">
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          className={cn("w-full justify-start text-destructive hover:text-destructive", collapsed && "justify-center")}
          onClick={handleLogout}
        >
          <LogOut className={cn("h-4 w-4", !collapsed && "mr-2")} />
          {!collapsed && "Logout"}
        </Button>
      </div>
    </aside>
  );
}
