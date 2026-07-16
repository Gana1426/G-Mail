import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MailHost Webmail",
  description: "Professional webmail for mailbox users",
};

export default function MailPortalRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
