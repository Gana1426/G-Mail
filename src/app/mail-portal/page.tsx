"use client";

import Link from "next/link";
import { MailLayout } from "@mail-portal/components/layout/mail-layout";
import { useMailDashboard } from "@mail-portal/hooks/use-mail-dashboard";
import { formatBytes, formatDateTime } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@mail-portal/components/ui/progress";
import { Inbox, Mail, HardDrive, PenSquare } from "lucide-react";
import { getFolderLabel } from "@mail-portal/lib/folders";

export default function MailPortalDashboardPage() {
  const { data, isLoading } = useMailDashboard();

  return (
    <MailLayout>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Mail Dashboard</h1>
            <p className="text-muted-foreground">Your mailbox overview</p>
          </div>
          <Button asChild>
            <Link href="/mail-portal/compose">
              <PenSquare className="mr-2 h-4 w-4" />
              Compose
            </Link>
          </Button>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Unread</CardTitle>
              <Inbox className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-3xl font-bold">{data?.unreadCount ?? 0}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Storage</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <>
                  <p className="text-sm font-medium">
                    {formatBytes(BigInt(data?.storageUsed ?? "0"))} /{" "}
                    {formatBytes(BigInt(data?.storageQuota ?? "0"))}
                  </p>
                  <Progress value={data?.storagePercent ?? 0} className="mt-2" />
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Folders</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-3xl font-bold">{data?.folders.length ?? 0}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Folders</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))
                : data?.folders.map((folder) => (
                    <Link
                      key={folder.id}
                      href={`/mail-portal/mail/${folder.id.toLowerCase()}`}
                      className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <span>{getFolderLabel(folder.id)}</span>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{folder.total} total</span>
                        {folder.unread > 0 && (
                          <Badge variant="secondary">{folder.unread} unread</Badge>
                        )}
                      </div>
                    </Link>
                  ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Emails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (data?.recentEmails ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent messages</p>
              ) : (
                data?.recentEmails.map((email) => (
                  <Link
                    key={email.uid}
                    href={`/mail-portal/mail/inbox?uid=${encodeURIComponent(email.uid)}`}
                    className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium">
                        {email.from.name ?? email.from.address}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDateTime(email.date)}
                      </span>
                    </div>
                    <p className="truncate text-sm">{email.subject}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {email.preview}
                    </p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MailLayout>
  );
}
