"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useMailKeyboardShortcuts(options: {
  onCompose?: () => void;
  onRefresh?: () => void;
  onSearch?: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "c" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        options.onCompose?.();
        router.push("/mail-portal/compose");
      }
      if (e.key === "r" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        options.onRefresh?.();
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        options.onSearch?.();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [options, router]);
}
