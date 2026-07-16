"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid verification link");
      return;
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const result = await res.json();
        if (!res.ok) throw new Error(result.error ?? "Verification failed");
        setStatus("success");
        setMessage(result.message ?? "Email verified successfully");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(
          err instanceof Error ? err.message : "Verification failed"
        );
      });
  }, [token]);

  return (
    <Card>
      <CardHeader className="text-center">
        {status === "loading" && (
          <>
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
            <CardTitle>Verifying your email</CardTitle>
            <CardDescription>Please wait...</CardDescription>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" />
            <CardTitle>Email verified</CardTitle>
            <CardDescription>{message}</CardDescription>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <CardTitle>Verification failed</CardTitle>
            <CardDescription>{message}</CardDescription>
          </>
        )}
      </CardHeader>
      {status !== "loading" && (
        <CardFooter className="justify-center">
          <Button onClick={() => router.push("/login")}>Go to Sign in</Button>
        </CardFooter>
      )}
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardContent className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
