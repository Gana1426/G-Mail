"use client";

import { X } from "lucide-react";
import { useToast as useToastPrimitive } from "@/hooks/use-toast";
import type { ToastVariant } from "@/hooks/use-toast";
import { cn } from "@/utils";

const variantStyles: Record<ToastVariant, string> = {
  default: "border-border bg-background text-foreground",
  destructive:
    "border-red-500/50 bg-red-600 text-white shadow-red-500/20",
  success:
    "border-emerald-500/50 bg-emerald-600 text-white shadow-emerald-500/20",
  warning:
    "border-amber-500/50 bg-amber-500 text-white shadow-amber-500/20",
  info: "border-blue-500/50 bg-blue-600 text-white shadow-blue-500/20",
};

export function Toaster() {
  const { toasts, dismiss } = useToastPrimitive();

  return (
    <div
      className="pointer-events-none fixed top-4 right-4 z-[9999] flex w-full max-w-[420px] flex-col gap-2 p-0 sm:top-4 sm:right-4"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((toast) => {
        const variant = toast.variant ?? "default";
        return (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto relative w-full animate-in slide-in-from-top-5 fade-in rounded-lg border p-4 pr-10 shadow-lg duration-300",
              variantStyles[variant]
            )}
            role="alert"
          >
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className={cn(
                "absolute right-2 top-2 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100",
                variant === "default"
                  ? "text-foreground/60 hover:text-foreground"
                  : "text-white/80 hover:text-white"
              )}
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
            {toast.title && (
              <p className="text-sm font-semibold leading-none">{toast.title}</p>
            )}
            {toast.description && (
              <p
                className={cn(
                  "text-sm",
                  toast.title ? "mt-1.5 opacity-90" : "opacity-90"
                )}
              >
                {toast.description}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
