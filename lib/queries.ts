import "server-only";

import { prisma } from "@/lib/db";
import { computeEnergy, bucketByDay, bucketByMonth, type PowerSample } from "@/lib/analytics/energy";
import { costForPeriod } from "@/lib/analytics/tariff";
import { toNumber } from "@/lib/utils";
import { getEnv } from "@/lib/env";

function asSample(row: {
  eventId: string;
  recordedAt: Date;
  activePowerW: { toString(): string };
  energyWh: { toString(): string };
  quality: PowerSample["quality"];
}): PowerSample {
  return {
    eventId: row.eventId,
    recordedAt: row.recordedAt,
    activePowerW: toNumber(row.activePowerW),
    energyWh: toNumber(row.energyWh),
    quality: row.quality,
  };
}

export async function latestReadingForSite(siteId: string) {
  const devices = await prisma.device.findMany({ where: { siteId } });
  const latest = await Promise.all(
    devices.map(async (device) => {
      const reading = await prisma.telemetryReading.findFirst({
        where: { deviceId: device.id },
        orderBy: { recordedAt: "desc" },
      });
      const staleAfter = (device.staleAfterSeconds || getEnv().STALE_AFTER_SECONDS) * 1000;
      const stale = !reading || Date.now() - reading.recordedAt.getTime() > staleAfter;
      return {
        device: {
          id: device.id,
          publicId: device.publicId,
          name: device.name,
          status: stale && device.status !== "REVOKED" ? "OFFLINE" : device.status,
          lastSeenAt: device.lastSeenAt,
          firmwareVersion: device.firmwareVersion,
          sensorModel: device.sensorModel,
        },
        reading: reading
          ? {
              eventId: reading.eventId,
              recordedAt: reading.recordedAt.toISOString(),
              voltageV: toNumber(reading.voltageV),
              currentA: toNumber(reading.currentA),
              activePowerW: toNumber(reading.activePowerW),
              powerFactor: toNumber(reading.powerFactor),
              frequencyHz: toNumber(reading.frequencyHz),
              energyWh: toNumber(reading.energyWh),
              quality: reading.quality,
              simulated: reading.simulated,
              units: reading.units,
              source: "postgresql",
            }
          : null,
        stale,
      };
    }),
  );
  return latest;
}

export async function historicalReadings(deviceIds: string[], from: Date, to: Date, take = 1000) {
  return prisma.telemetryReading.findMany({
    where: { deviceId: { in: deviceIds }, recordedAt: { gte: from, lte: to } },
    orderBy: { recordedAt: "asc" },
    take: Math.min(take, 5000),
  });
}

export async function analyticsForSite(siteId: string, from: Date, to: Date) {
  const [site, devices, tariffs] = await Promise.all([
    prisma.site.findUniqueOrThrow({ where: { id: siteId } }),
    prisma.device.findMany({ where: { siteId } }),
    prisma.tariff.findMany({ where: { siteId }, orderBy: { effectiveFrom: "asc" } }),
  ]);
  const readings = await historicalReadings(
    devices.map((d) => d.id),
    from,
    to,
    5000,
  );
  const samples = readings.map(asSample);
  const totals = computeEnergy(samples);
  const daily = bucketByDay(samples, site.timezone);
  const monthly = bucketByMonth(samples, site.timezone);
  const cost = costForPeriod(
    daily.map((d) => ({
      start: new Date(`${d.day}T00:00:00.000Z`),
      end: new Date(`${d.day}T23:59:59.000Z`),
      energyKwh: d.energyKwh,
    })),
    tariffs,
    site.currency,
    totals.incomplete,
  );

  return {
    timezone: site.timezone,
    currency: site.currency,
    totals: {
      energyKwh: totals.energyKwh.toNumber(),
      peakPowerW: totals.peakPowerW.toNumber(),
      avgPowerW: totals.avgPowerW.toNumber(),
      method: totals.method,
      incomplete: totals.incomplete,
      resets: totals.resets,
      assumptions: totals.assumptions,
    },
    daily: daily.map((d) => ({
      day: d.day,
      energyKwh: d.energyKwh.toNumber(),
      peakPowerW: d.peakPowerW.toNumber(),
      incomplete: d.incomplete,
    })),
    monthly: monthly.map((m) => ({
      month: m.month,
      energyKwh: m.energyKwh.toNumber(),
      incomplete: m.incomplete,
    })),
    cost: {
      amount: cost.amount.toNumber(),
      currency: cost.currency,
      estimated: true,
      incomplete: cost.incomplete,
    },
    series: readings.slice(-500).map((r) => ({
      t: r.recordedAt.toISOString(),
      w: toNumber(r.activePowerW),
      simulated: r.simulated,
    })),
  };
}
