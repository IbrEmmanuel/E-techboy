import { requireUser } from "@/lib/auth/session";
import { requireSiteRole } from "@/lib/auth/access";
import { latestReadingForSite } from "@/lib/queries";
import { getEnv } from "@/lib/env";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { LIVE_UPDATE_NOTE } from "@/types";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const siteId = new URL(request.url).searchParams.get("siteId");
    if (!siteId) return jsonError("VALIDATION_ERROR", "siteId is required", 400);
    await requireSiteRole(user, siteId);
    const devices = await latestReadingForSite(siteId);
    return jsonOk({
      devices,
      pollIntervalMs: getEnv().LIVE_POLL_INTERVAL_MS,
      note: LIVE_UPDATE_NOTE,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
