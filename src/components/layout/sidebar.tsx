"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/utils";
import { useUIStore, useAuthStore } from "@/hooks/use-store";
import { useOnboarding } from "@/hooks/use-onboarding";
import {
  LayoutDashboard,
  Building2,
  Globe,
  Mail,
  Users,
  Forward,
  Shield,
  ListOrdered,
  HardDrive,
  ScrollText,
  Settings,
  User,
  ChevronLeft,
  Menu,
  LogOut,
  Lock,
  Server,
  KeyRound,
  Inbox,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrgBillingGuard } from "@/components/org/org-billing-guard";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  locked?: boolean;
  lockMessage?: string;
}

/** Super Admin only — platform operations */
const superAdminNav: NavItem[] = [
  { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { title: "Organizations", href: "/admin/organizations", icon: Building2 },
  { title: "Plans", href: "/admin/plans", icon: CreditCard },
  { title: "Domains", href: "/admin/domains", icon: Globe },
  { title: "Mailboxes", href: "/admin/mailboxes", icon: Mail },
  { title: "Aliases", href: "/admin/aliases", icon: Users },
  { title: "Forwarders", href: "/admin/forwarders", icon: Forward },
  { title: "Spam Queue", href: "/admin/spam", icon: Shield },
  { title: "Mail Queue", href: "/admin/queue", icon: ListOrdered },
  { title: "Storage", href: "/admin/storage", icon: HardDrive },
  { title: "System Logs", href: "/admin/logs", icon: ScrollText },
  { title: "Server Settings", href: "/admin/settings", icon: Server },
  { title: "Profile", href: "/admin/profile", icon: User },
];

/** Organization Admin */
function getOrgNav(hasVerifiedDomain: boolean): NavItem[] {
  const locked = !hasVerifiedDomain;
  const lockMessage =
    "Please add and verify your first domain before using Mail Hosting features.";

  const items: NavItem[] = [
    { title: "Dashboard", href: "/org", icon: LayoutDashboard },
    { title: "Subscription", href: "/org/subscription", icon: CreditCard },
    { title: "Domains", href: "/org/domains", icon: Globe },
    {
      title: "Mailboxes",
      href: "/org/mailboxes",
      icon: Mail,
      locked,
      lockMessage,
    },
    {
      title: "Aliases",
      href: "/org/aliases",
      icon: Users,
      locked,
      lockMessage,
    },
    {
      title: "Forwarders",
      href: "/org/forwarders",
      icon: Forward,
      locked,
      lockMessage,
    },
    {
      title: "Groups",
      href: "/org/groups",
      icon: Users,
      locked,
      lockMessage,
    },
    {
      title: "Storage",
      href: "/org/storage",
      icon: HardDrive,
      locked,
      lockMessage,
    },
    {
      title: "Spam",
      href: "/org/spam",
      icon: Shield,
      locked,
      lockMessage,
    },
    {
      title: "Mail Queue",
      href: "/org/queue",
      icon: ListOrdered,
      locked,
      lockMessage,
    },
    { title: "DNS", href: "/org/dns", icon: Globe },
    { title: "Settings", href: "/org/settings", icon: Settings },
    { title: "Profile", href: "/org/profile", icon: User }
  ];

  return items;
}

/** Mail User */
const mailUserNav: NavItem[] = [
  { title: "Dashboard", href: "/portal", icon: LayoutDashboard },
  { title: "My Mailbox", href: "/portal/mailbox", icon: Inbox },
  { title: "Webmail", href: "/portal/webmail", icon: Mail },
  { title: "Storage", href: "/portal/storage", icon: HardDrive },
  { title: "Profile", href: "/portal/profile", icon: User },
  { title: "Security", href: "/portal/security", icon: KeyRound },
  { title: "Settings", href: "/portal/settings", icon: Settings },
];

function NavLink({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  const content = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        item.locked
          ? "cursor-not-allowed text-muted-foreground opacity-60"
          : isActive
            ? "bg-sidebar-accent text-sidebar-primary"
            : "text-sidebar-foreground hover:bg-sidebar-accent/50"
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="flex-1">{item.title}</span>}
      {!collapsed && item.locked && <Lock className="h-3.5 w-3.5" />}
    </div>
  );

  if (item.locked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block">{content}</span>
        </TooltipTrigger>
        <TooltipContent>{item.lockMessage}</TooltipContent>
      </Tooltip>
    );
  }

  return <Link href={item.href}>{content}</Link>;
}

interface SidebarProps {
  variant: "admin" | "org" | "portal";
}

export function Sidebar({ variant }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();
  const { user, logout } = useAuthStore();
  const { data: onboarding } = useOnboarding(variant === "org");

  const navItems =
    variant === "admin"
      ? superAdminNav
      : variant === "org"
        ? getOrgNav(onboarding?.hasVerifiedDomain ?? false)
        : mailUserNav;

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // continue local logout
    }
    logout();
    router.push("/login");
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-sidebar transition-all duration-300",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!sidebarCollapsed && (
            <Link href="/" className="flex items-center gap-2 font-bold text-primary">
              <Mail className="h-6 w-6" />
              <span>MailHost</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="h-8 w-8"
          >
            {sidebarCollapsed ? (
              <Menu className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== `/${variant}` &&
                item.href !== "/org" &&
                pathname.startsWith(item.href));

            return (
              <NavLink
                key={item.href}
                item={item}
                isActive={isActive}
                collapsed={sidebarCollapsed}
              />
            );
          })}
        </nav>

        <div className="border-t p-2">
          {!sidebarCollapsed && user && (
            <p className="mb-2 truncate px-3 text-xs text-muted-foreground">
              {user.firstName} {user.lastName}
            </p>
          )}
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 text-muted-foreground hover:text-destructive",
              sidebarCollapsed && "justify-center px-0"
            )}
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>Logout</span>}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}

export function Header({
  title,
  breadcrumbs,
}: {
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span>/</span>}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-foreground">
                    {crumb.label}
                  </Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
    </header>
  );
}

export function DashboardLayout({
  children,
  variant,
  title,
  breadcrumbs,
}: {
  children: React.ReactNode;
  variant: "admin" | "org" | "portal";
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
}) {
  const { sidebarCollapsed } = useUIStore();
  const pathname = usePathname();
  const skipBillingGuard = pathname.startsWith("/org/choose-plan");

  const content =
    variant === "org" && !skipBillingGuard ? (
      <OrgBillingGuard>{children}</OrgBillingGuard>
    ) : (
      children
    );

  return (
    <div className="min-h-screen bg-background">
      <Sidebar variant={variant} />
      <div className={cn("transition-all", sidebarCollapsed ? "ml-16" : "ml-64")}>
        <Header title={title} breadcrumbs={breadcrumbs} />
        <main className="p-6">{content}</main>
      </div>
    </div>
  );
}
