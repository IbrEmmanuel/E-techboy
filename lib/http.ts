import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getEnv } from "@/lib/env";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function securityHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Cache-Control", "no-store");
  return headers;
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: securityHeaders() });
}

export function jsonError(code: string, message: string, status: number, details?: unknown) {
  const body: ApiErrorBody = { error: { code, message, details } };
  return NextResponse.json(body, { status, headers: securityHeaders() });
}

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return jsonError("VALIDATION_ERROR", "Request validation failed", 400, error.issues);
  }
  if (error instanceof HttpError) {
    return jsonError(error.code, error.message, error.status);
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("Invalid environment") || /secret|password|DATABASE_URL/i.test(message)) {
    console.error("Route error (redacted)");
    return jsonError("INTERNAL_ERROR", "The service is temporarily unavailable", 500);
  }
  console.error("Route error", message);
  return jsonError("INTERNAL_ERROR", "The service is temporarily unavailable", 500);
}

export class HttpError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function corsHeaders(origin: string | null) {
  const env = getEnv();
  const allowed = env.APP_URL.replace(/\/$/, "");
  const headers = securityHeaders();
  if (origin && origin.replace(/\/$/, "") === allowed) {
    headers.set("Access-Control-Allow-Origin", allowed);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Credentials", "true");
  }
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  return headers;
}

export function parsePagination(searchParams: URLSearchParams) {
  const take = Math.min(Number(searchParams.get("limit") ?? 50) || 50, 200);
  const cursor = searchParams.get("cursor");
  return { take, cursor };
}
