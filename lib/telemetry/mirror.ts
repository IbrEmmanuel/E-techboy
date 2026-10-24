import "server-only";

import type { Device, ProtocolKind } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { asJsonOrUndefined } from "@/lib/json";

export type EnergyMirror = {
  eventId: string;
  recordedAt: Date;
  voltageV: number;
  currentA: number;
  activePowerW: number;
  powerFactor: number;
  frequencyHz: number;
  energyWh: number;
  quality?: "GOOD" | "ESTIMATED" | "SUSPECT" | "INVALID";
  simulated: boolean;
  firmwareVersion?: string | null;
  protocol?: ProtocolKind;
};

/** Mirror legacy energy readings into universal measurement keys for device dashboards. */
export async function mirrorEnergyToUniversal(device: Device, reading: EnergyMirror) {
  const protocol = reading.protocol ?? device.protocol;
  const quality = reading.quality ?? "GOOD";
  const rows = [
    { key: "voltage", valueNumber: reading.voltageV, unit: "V" },
    { key: "current", valueNumber: reading.currentA, unit: "A" },
    { key: "active_power", valueNumber: reading.activePowerW, unit: "W" },
    { key: "power_factor", valueNumber: reading.powerFactor, unit: "1" },
    { key: "frequency", valueNumber: reading.frequencyHz, unit: "Hz" },
    { key: "energy", valueNumber: reading.energyWh, unit: "Wh" },
  ].map((m) => ({
    deviceId: device.id,
    eventId: reading.eventId,
    protocol,
    recordedAt: reading.recordedAt,
    schemaVersion: 1,
    key: m.key,
    valueNumber: m.valueNumber,
    valueBool: null as boolean | null,
    valueText: null as string | null,
    valueType: "NUMBER" as const,
    unit: m.unit,
    quality,
    simulated: reading.simulated,
    metadata: asJsonOrUndefined({
      mirroredFrom: "legacy_telemetry",
      firmware: reading.firmwareVersion ?? undefined,
    }),
  }));

  try {
    await prisma.universalMeasurement.createMany({ data: rows });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return { duplicate: true };
    throw error;
  }

  await prisma.device.update({
    where: { id: device.id },
    data: {
      lastSuccessfulAt: reading.recordedAt,
      connectionState: "CONNECTED",
      lastError: null,
    },
  });

  return { duplicate: false };
}

export type UniversalBag = Record<string, number>;

/** When universal ingest includes a full energy set, also write TelemetryReading for dashboard/analytics. */
export async function mirrorUniversalToLegacy(
  device: Device,
  eventId: string,
  recordedAt: Date,
  bag: UniversalBag,
  opts: {
    simulated: boolean;
    firmwareVersion?: string | null;
    quality?: "GOOD" | "ESTIMATED" | "SUSPECT" | "INVALID";
  },
) {
  const voltageV = bag.voltage ?? bag.voltageV;
  const currentA = bag.current ?? bag.currentA;
  const activePowerW = bag.active_power ?? bag.activePowerW ?? bag.power;
  const powerFactor = bag.power_factor ?? bag.powerFactor ?? 1;
  const frequencyHz = bag.frequency ?? bag.frequencyHz ?? 50;
  const energyWh = bag.energy ?? bag.energyWh ?? bag.energy_wh;

  if (
    voltageV == null ||
    currentA == null ||
    activePowerW == null ||
    energyWh == null ||
    !Number.isFinite(voltageV) ||
    !Number.isFinite(currentA) ||
    !Number.isFinite(activePowerW) ||
    !Number.isFinite(energyWh)
  ) {
    return { written: false };
  }

  try {
    await prisma.telemetryReading.create({
      data: {
        deviceId: device.id,
        eventId: `u:${eventId}`,
        recordedAt,
        schemaVersion: 1,
        voltageV: new Prisma.Decimal(voltageV),
        currentA: new Prisma.Decimal(currentA),
        activePowerW: new Prisma.Decimal(activePowerW),
        powerFactor: new Prisma.Decimal(powerFactor),
        frequencyHz: new Prisma.Decimal(frequencyHz),
        energyWh: new Prisma.Decimal(energyWh),
        quality: opts.quality ?? "GOOD",
        simulated: opts.simulated,
        firmwareVersion: opts.firmwareVersion ?? device.firmwareVersion,
        units: {
          voltage: "V",
          current: "A",
          activePower: "W",
          energy: "Wh",
          frequency: "Hz",
          powerFactor: "1",
        },
      },
    });
    return { written: true };
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return { written: false, duplicate: true };
    throw error;
  }
}

export function bagFromUniversalRows(
  rows: { key: string; valueNumber: number | null }[],
): UniversalBag {
  const bag: UniversalBag = {};
  for (const row of rows) {
    if (row.valueNumber != null) bag[row.key] = row.valueNumber;
  }
  return bag;
}
