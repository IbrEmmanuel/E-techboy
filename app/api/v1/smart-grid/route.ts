import { requireUser } from "@/lib/auth/session";
import { requireSiteRole } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { toNumber } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const siteId = new URL(request.url).searchParams.get("siteId");
    if (!siteId) return jsonError("VALIDATION_ERROR", "siteId is required", 400);
    await requireSiteRole(user, siteId);

    const [snapshots, latestEnergy, devices] = await Promise.all([
      prisma.gridSnapshot.findMany({
        where: { siteId },
        orderBy: { recordedAt: "desc" },
        take: 48,
      }),
      prisma.telemetryReading.findMany({
        where: { device: { siteId } },
        orderBy: { recordedAt: "desc" },
        take: 20,
        include: { device: { select: { name: true, publicId: true, category: true, protocol: true } } },
      }),
      prisma.device.findMany({
        where: { siteId, category: { in: ["SMART_GRID", "SOLAR_INVERTER", "BMS", "SMART_METER", "ESP32"] } },
        select: {
          id: true,
          name: true,
          publicId: true,
          category: true,
          connectionState: true,
          lastSeenAt: true,
          demoMode: true,
        },
      }),
    ]);

    const latest = snapshots[0];
    const derivedFromMeters = latestEnergy[0]
      ? {
          voltageV: toNumber(latestEnergy[0].voltageV),
          currentA: toNumber(latestEnergy[0].currentA),
          frequencyHz: toNumber(latestEnergy[0].frequencyHz),
          activePowerW: toNumber(latestEnergy[0].activePowerW),
          powerFactor: toNumber(latestEnergy[0].powerFactor),
          sourceDevice: latestEnergy[0].device.name,
          recordedAt: latestEnergy[0].recordedAt,
          simulated: latestEnergy[0].simulated,
        }
      : null;

    return jsonOk({
      siteId,
      snapshot: latest,
      history: snapshots,
      derivedFromMeters,
      devices,
      disclaimer:
        "This workspace aggregates compatible site telemetry. It does not claim direct utility smart-grid access, automatic islanding, or protection-relay control.",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
