import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { allowSimulatedTelemetry } from "@/lib/env";
import { energyWhFromPayload, telemetryIngestSchema, UNITS, type TelemetryIngest } from "@/lib/validation/telemetry";
import { evaluateReading } from "@/lib/alerts/evaluate";
import { computeEnergy, type PowerSample } from "@/lib/analytics/energy";
import { toNumber } from "@/lib/utils";
import { HttpError } from "@/lib/http";
import type { Device } from "@prisma/client";

export async function ingestTelemetry(device: Device, body: unknown) {
  const payload = telemetryIngestSchema.parse(body);
  if (payload.deviceId !== device.publicId) {
    throw new HttpError("VALIDATION_ERROR", "deviceId does not match authenticated device", 400);
  }
  if (payload.simulated && !allowSimulatedTelemetry()) {
    throw new HttpError("VALIDATION_ERROR", "Simulated telemetry is not accepted in this environment", 400);
  }

  const energyWh = energyWhFromPayload(payload);
  const recordedAt = new Date(payload.timestamp);
  const previous = await prisma.telemetryReading.findFirst({
    where: { deviceId: device.id },
    orderBy: { recordedAt: "desc" },
  });
  const resetDetected = Boolean(previous && energyWh + 10 < toNumber(previous.energyWh) * 0.5);

  try {
    const reading = await prisma.telemetryReading.create({
      data: {
        deviceId: device.id,
        eventId: payload.eventId,
        recordedAt,
        schemaVersion: payload.schemaVersion,
        voltageV: new Prisma.Decimal(payload.measurements.voltageV),
        currentA: new Prisma.Decimal(payload.measurements.currentA),
        activePowerW: new Prisma.Decimal(payload.measurements.activePowerW),
        powerFactor: new Prisma.Decimal(payload.measurements.powerFactor),
        frequencyHz: new Prisma.Decimal(payload.measurements.frequencyHz),
        energyWh: new Prisma.Decimal(energyWh),
        energyResetDetected: resetDetected,
        quality: payload.measurements.quality ?? (payload.sensorError ? "SUSPECT" : "GOOD"),
        simulated: Boolean(payload.simulated),
        firmwareVersion: payload.firmwareVersion,
        sensorError: payload.sensorError,
        units: payload.units ?? UNITS,
      },
    });

    await prisma.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: recordedAt,
        lastEventId: payload.eventId,
        firmwareVersion: payload.firmwareVersion ?? device.firmwareVersion,
        status: device.status === "REVOKED" ? "REVOKED" : "ACTIVE",
      },
    });

    await prisma.deviceEvent.create({
      data: {
        deviceId: device.id,
        type: resetDetected ? "ENERGY_RESET" : "TELEMETRY",
        payload: { eventId: payload.eventId, sensorError: payload.sensorError ?? null },
      },
    });

    await applyAlerts(device, payload, energyWh, recordedAt);

    const { mirrorEnergyToUniversal } = await import("@/lib/telemetry/mirror");
    await mirrorEnergyToUniversal(device, {
      eventId: payload.eventId,
      recordedAt,
      voltageV: payload.measurements.voltageV,
      currentA: payload.measurements.currentA,
      activePowerW: payload.measurements.activePowerW,
      powerFactor: payload.measurements.powerFactor,
      frequencyHz: payload.measurements.frequencyHz,
      energyWh,
      quality: payload.measurements.quality ?? (payload.sensorError ? "SUSPECT" : "GOOD"),
      simulated: Boolean(payload.simulated),
      firmwareVersion: payload.firmwareVersion,
    });

    const { snapshotFromEnergyReading, writeGridSnapshot } = await import("@/lib/smart-grid/snapshot");
    await writeGridSnapshot(
      device.siteId,
      snapshotFromEnergyReading({
        recordedAt,
        voltageV: payload.measurements.voltageV,
        currentA: payload.measurements.currentA,
        frequencyHz: payload.measurements.frequencyHz,
        activePowerW: payload.measurements.activePowerW,
        powerFactor: payload.measurements.powerFactor,
        energyWh,
        simulated: Boolean(payload.simulated),
      }),
      device,
    );

    const { runAutomationAfterIngest } = await import("@/lib/automation/runner");
    await runAutomationAfterIngest(device, {
      voltage: payload.measurements.voltageV,
      current: payload.measurements.currentA,
      active_power: payload.measurements.activePowerW,
      power_factor: payload.measurements.powerFactor,
      frequency: payload.measurements.frequencyHz,
      energy: energyWh,
    });

    return { reading, duplicate: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.telemetryReading.findUnique({
        where: { deviceId_eventId: { deviceId: device.id, eventId: payload.eventId } },
      });
      return { reading: existing, duplicate: true };
    }
    throw error;
  }
}

async function applyAlerts(device: Device, payload: TelemetryIngest, energyWh: number, recordedAt: Date) {
  const [rules, openAlerts, todaySamples] = await Promise.all([
    prisma.alertRule.findMany({ where: { siteId: device.siteId, enabled: true } }),
    prisma.alert.findMany({ where: { deviceId: device.id, status: { in: ["OPEN", "ACKNOWLEDGED"] } } }),
    prisma.telemetryReading.findMany({
      where: { deviceId: device.id, recordedAt: { gte: startOfUtcDay(recordedAt) } },
      orderBy: { recordedAt: "asc" },
    }),
  ]);

  const samples: PowerSample[] = todaySamples.map((row) => ({
    eventId: row.eventId,
    recordedAt: row.recordedAt,
    activePowerW: toNumber(row.activePowerW),
    energyWh: toNumber(row.energyWh),
    quality: row.quality,
  }));
  const daily = computeEnergy(samples);

  const decisions = evaluateReading({
    deviceId: device.id,
    reading: {
      voltageV: payload.measurements.voltageV,
      currentA: payload.measurements.currentA,
      activePowerW: payload.measurements.activePowerW,
      energyWh,
      quality: payload.measurements.quality ?? "GOOD",
      recordedAt,
    },
    rules,
    openAlerts,
    dailyEnergyKwh: daily.energyKwh.toNumber(),
  });

  for (const decision of decisions) {
    if (decision.action === "resolve") {
      await prisma.alert.updateMany({
        where: { fingerprint: decision.fingerprint, deviceId: device.id, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
        data: { status: "RESOLVED", resolvedAt: recordedAt },
      });
      continue;
    }
    if (decision.action === "refresh") {
      await prisma.alert.updateMany({
        where: { fingerprint: decision.fingerprint, deviceId: device.id, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
        data: { lastSeenAt: recordedAt, valueNumeric: new Prisma.Decimal(decision.value) },
      });
      continue;
    }
    if (decision.action !== "open") continue;
    await prisma.alert.create({
      data: {
        siteId: device.siteId,
        deviceId: device.id,
        type: decision.type,
        severity: decision.severity,
        title: decision.title,
        message: decision.message,
        valueNumeric: new Prisma.Decimal(decision.value),
        unit: decision.unit,
        fingerprint: decision.fingerprint,
      },
    });
    const recipients = await prisma.userPreference.findMany({
      where: { notifyEmail: true, user: { memberships: { some: { siteId: device.siteId } } } },
      include: { user: true },
    });
    const { sendAlertEmail } = await import("@/lib/email");
    await sendAlertEmail(
      recipients.map((r) => r.user.email),
      `[EMS] ${decision.title}`,
      decision.message,
    );
  }
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
