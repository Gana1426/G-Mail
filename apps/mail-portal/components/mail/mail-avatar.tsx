"use client";

import { cn } from "@/utils";
import { avatarColor, getInitials } from "@mail-portal/lib/format-mail-date";

interface MailAvatarProps {
  name?: string;
  email?: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

export function MailAvatar({
  name,
  email,
  avatarUrl,
  size = "md",
  className,
}: MailAvatarProps) {
  const seed = email ?? name ?? "?";
  const initials = getInitials(name, email);

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? email ?? "User"}
        className={cn("shrink-0 rounded-full object-cover", SIZE_CLASSES[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-medium text-white",
        avatarColor(seed),
        SIZE_CLASSES[size],
        className
      )}
      aria-hidden
    >
      {initials}
    </div>
  );
}
