import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/mail-portal/login",
  "/api/auth/login",
  "/api/auth/register",
  "/api/onboarding/register",
  "/api/webhooks/razorpay",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/verify-email",
  "/api/auth/refresh",
  "/api/mail/login",
];

const roleRoutes: Record<string, string[]> = {
  SUPER_ADMIN: ["/admin"],
  ORG_ADMIN: ["/org"],
  MAIL_USER: ["/portal"],
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    publicPaths.some((path) => pathname.startsWith(path)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/mail/login") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const mailSessionToken = request.cookies.get("mail_session")?.value;
  const isMailPortal =
    pathname.startsWith("/mail-portal") ||
    pathname.startsWith("/api/mail/");

  if (isMailPortal) {
    if (!mailSessionToken && !pathname.startsWith("/mail-portal/login")) {
      if (pathname.startsWith("/api/mail/")) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 }
        );
      }
      const loginUrl = new URL("/mail-portal/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  const accessToken = request.cookies.get("access_token")?.value;

  if (!accessToken && !pathname.startsWith("/api/")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!accessToken && pathname.startsWith("/api/")) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
