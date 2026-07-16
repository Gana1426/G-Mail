import { Suspense } from "react";
import { MailSearchPage } from "@mail-portal/features/search-page";

export default function Page() {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" />}
    >
      <MailSearchPage />
    </Suspense>
  );
}
