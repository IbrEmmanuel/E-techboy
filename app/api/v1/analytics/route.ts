import { requireUser } from "@/lib/auth/session";
import { requireSiteRole } from "@/lib/auth/access";
import { analyticsForSite } from "@/lib/queries";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const siteId = url.searchParams.get("siteId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!siteId || !from || !to) return jsonError("VALIDATION_ERROR", "siteId, from, and to are required", 400);
    await requireSiteRole(user, siteId);
    const analytics = await analyticsForSite(siteId, new Date(from), new Date(to));
    return jsonOk({ analytics });
  } catch (error) {
    return handleRouteError(error);
  }
}
