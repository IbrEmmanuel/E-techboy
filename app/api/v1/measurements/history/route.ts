import { requireUser } from "@/lib/auth/session";
import { requireDeviceAccess, requireSiteRole } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { handleRouteError, jsonError, jsonOk, parsePagination } from "@/lib/http";
import { toNumber } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const siteId = url.searchParams.get("siteId");
    const deviceId = url.searchParams.get("deviceId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!siteId || !from || !to) return jsonError("VALIDATION_ERROR", "siteId, from, and to are required", 400);
    await requireSiteRole(user, siteId);
    if (deviceId) await requireDeviceAccess(user, deviceId);
    const { take, cursor } = parsePagination(url.searchParams);
    const devices = deviceId
      ? [{ id: deviceId }]
      : await prisma.device.findMany({ where: { siteId }, select: { id: true } });
    const readings = await prisma.telemetryReading.findMany({
      where: {
        deviceId: { in: devices.map((d) => d.id) },
        recordedAt: { gte: new Date(from), lte: new Date(to) },
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { recordedAt: "asc" },
      take,
    });
    return jsonOk({
      readings: readings.map((r) => ({
        id: r.id,
        deviceId: r.deviceId,
        eventId: r.eventId,
        recordedAt: r.recordedAt,
        voltageV: toNumber(r.voltageV),
        currentA: toNumber(r.currentA),
        activePowerW: toNumber(r.activePowerW),
        powerFactor: toNumber(r.powerFactor),
        frequencyHz: toNumber(r.frequencyHz),
        energyWh: toNumber(r.energyWh),
        quality: r.quality,
        simulated: r.simulated,
        source: "postgresql",
      })),
      nextCursor: readings.at(-1)?.id ?? null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
