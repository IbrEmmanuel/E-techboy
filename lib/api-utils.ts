import { NextRequest } from "next/server";
import { corsHeaders, handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { requireSiteRole } from "@/lib/auth/access";
import type { Role } from "@prisma/client";

export function withCors(request: NextRequest, response: Response) {
  const headers = corsHeaders(request.headers.get("origin"));
  headers.forEach((value, key) => response.headers.set(key, value));
  return response;
}

export async function readJson(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    throw Object.assign(new Error("Invalid JSON"), { code: "VALIDATION_ERROR" });
  }
}

export async function siteFromRequest(request: NextRequest, minRole: Role = "VIEWER") {
  const user = await requireUser();
  const siteId = request.nextUrl.searchParams.get("siteId");
  if (!siteId) {
    return { user, siteId: null as string | null };
  }
  await requireSiteRole(user, siteId, minRole);
  return { user, siteId };
}

export { jsonOk, jsonError, handleRouteError };
