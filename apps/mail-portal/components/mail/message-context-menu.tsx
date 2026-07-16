"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/utils";
import type { LucideIcon } from "lucide-react";

interface MessageContextMenuProps {
  children: ReactNode;
  items: Array<{
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    separator?: boolean;
    destructive?: boolean;
  }>;
  disabled?: boolean;
}

interface MenuState {
  x: number;
  y: number;
}

export function MessageContextMenu({
  children,
  items,
  disabled,
}: MessageContextMenuProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);

  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu, close]);

  if (disabled || items.length === 0) return <>{children}</>;

  return (
    <>
      <div
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        {children}
      </div>
      {menu && (
        <div
          className="fixed z-50 min-w-[11rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, index) => (
            <div key={item.label}>
              {item.separator && index > 0 && (
                <div className="my-1 h-px bg-border" />
              )}
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted",
                  item.destructive && "text-destructive"
                )}
                onClick={() => {
                  item.onClick();
                  close();
                }}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
