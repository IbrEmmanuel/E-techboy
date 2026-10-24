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
    const format = url.searchParams.get("format") ?? "json";
    if (!siteId || !from || !to) return jsonError("VALIDATION_ERROR", "siteId, from, and to are required", 400);
    await requireSiteRole(user, siteId);
    const analytics = await analyticsForSite(siteId, new Date(from), new Date(to));
    if (format === "csv") {
      const lines = [
        "day,energy_kwh,peak_power_w,incomplete",
        ...analytics.daily.map((d) => `${d.day},${d.energyKwh},${d.peakPowerW},${d.incomplete}`),
      ];
      return new Response(lines.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="energy-report.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }
    return jsonOk({ report: analytics, estimatedCost: analytics.cost });
  } catch (error) {
    return handleRouteError(error);
  }
}
