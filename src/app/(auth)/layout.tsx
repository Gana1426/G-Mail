import Link from "next/link";
import { Mail } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex flex-col items-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Mail className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold">MailHost Platform</h1>
            <p className="text-muted-foreground mt-1">Enterprise Mail Hosting</p>
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
