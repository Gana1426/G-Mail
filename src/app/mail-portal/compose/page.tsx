"use client";

import { Suspense } from "react";
import { ComposePage } from "@mail-portal/features/compose-page";

export default function MailComposeRoute() {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" />}
    >
      <ComposePage />
    </Suspense>
  );
}
