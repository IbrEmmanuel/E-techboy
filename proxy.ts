import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/auth/session-cookie";

const protectedPages = [
  "/dashboard",
  "/devices",
  "/integrations",
  "/automation",
  "/smart-grid",
  "/gateways",
  "/billing",
  "/analytics",
  "/alerts",
  "/reports",
  "/settings",
];

async function sessionLooksValid(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return true;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await sessionLooksValid(raw);
  const shouldClear = Boolean(raw) && !session;

  if (pathname === "/") {
    const response = NextResponse.redirect(new URL(session ? "/dashboard" : "/login", request.url));
    if (shouldClear) clearSessionCookie(response);
    return response;
  }

  const isProtected = protectedPages.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isProtected && !session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("from", pathname);
    const response = NextResponse.redirect(login);
    if (shouldClear) clearSessionCookie(response);
    return response;
  }

  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const response = NextResponse.next();
  if (shouldClear) clearSessionCookie(response);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/devices/:path*",
    "/integrations/:path*",
    "/automation/:path*",
    "/smart-grid/:path*",
    "/gateways/:path*",
    "/billing/:path*",
    "/analytics/:path*",
    "/alerts/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/login",
  ],
};
