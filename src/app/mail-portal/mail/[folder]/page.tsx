"use client";

import { Suspense, use } from "react";
import { MailFolderPage } from "@mail-portal/features/mail-folder-page";

export default function MailFolderRoute({
  params,
}: {
  params: Promise<{ folder: string }>;
}) {
  const { folder } = use(params);
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" />}
    >
      <MailFolderPage folderSlug={folder} />
    </Suspense>
  );
}
