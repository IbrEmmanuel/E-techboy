import "server-only";

import type { Device } from "@prisma/client";
import { prisma } from "@/lib/db";
import { asJsonOrUndefined } from "@/lib/json";

export type SnapshotInput = {
  recordedAt: Date;
  voltageV?: number;
  currentA?: number;
  frequencyHz?: number;
  activePowerW?: number;
  powerFactor?: number;
  importEnergyKwh?: number;
  exportEnergyKwh?: number;
  solarPowerW?: number;
  batterySocPct?: number;
  batteryPowerW?: number;
  gridAvailable?: boolean;
  inverterStatus?: string;
  peakDemandW?: number;
  metadata?: Record<string, unknown>;
};

/**
 * Upsert a site energy-balance snapshot from meter / inverter / BMS telemetry.
 * Throttled to at most one write per ~55s per site to avoid flooding.
 */
export async function writeGridSnapshot(siteId: string, input: SnapshotInput, sourceDevice?: Device) {
  const latest = await prisma.gridSnapshot.findFirst({
    where: { siteId },
    orderBy: { recordedAt: "desc" },
  });

  const meta = {
    ...(input.metadata ?? {}),
    sourceDeviceId: sourceDevice?.id,
    sourceDeviceName: sourceDevice?.name,
  };

  // Within the throttle window, merge richer fields (solar/battery) into the latest row.
  if (latest && input.recordedAt.getTime() - latest.recordedAt.getTime() < 55_000) {
    const snap = await prisma.gridSnapshot.update({
      where: { id: latest.id },
      data: {
        recordedAt: input.recordedAt,
        voltageV: input.voltageV ?? latest.voltageV,
        currentA: input.currentA ?? latest.currentA,
        frequencyHz: input.frequencyHz ?? latest.frequencyHz,
        activePowerW: input.activePowerW ?? latest.activePowerW,
        powerFactor: input.powerFactor ?? latest.powerFactor,
        importEnergyKwh: input.importEnergyKwh ?? latest.importEnergyKwh,
        exportEnergyKwh: input.exportEnergyKwh ?? latest.exportEnergyKwh,
        solarPowerW: input.solarPowerW ?? latest.solarPowerW,
        batterySocPct: input.batterySocPct ?? latest.batterySocPct,
        batteryPowerW: input.batteryPowerW ?? latest.batteryPowerW,
        gridAvailable: input.gridAvailable ?? latest.gridAvailable,
        inverterStatus: input.inverterStatus ?? latest.inverterStatus,
        peakDemandW: input.peakDemandW ?? latest.peakDemandW,
        metadata: asJsonOrUndefined(meta),
      },
    });
    return { written: true, id: snap.id, merged: true as const };
  }

  const snap = await prisma.gridSnapshot.create({
    data: {
      siteId,
      recordedAt: input.recordedAt,
      voltageV: input.voltageV,
      currentA: input.currentA,
      frequencyHz: input.frequencyHz,
      activePowerW: input.activePowerW,
      powerFactor: input.powerFactor,
      importEnergyKwh: input.importEnergyKwh,
      exportEnergyKwh: input.exportEnergyKwh,
      solarPowerW: input.solarPowerW,
      batterySocPct: input.batterySocPct,
      batteryPowerW: input.batteryPowerW,
      gridAvailable: input.gridAvailable ?? true,
      inverterStatus: input.inverterStatus,
      peakDemandW: input.peakDemandW,
      metadata: asJsonOrUndefined(meta),
    },
  });

  return { written: true, id: snap.id };
}

export function snapshotFromEnergyReading(
  reading: {
    recordedAt: Date;
    voltageV: number;
    currentA: number;
    frequencyHz: number;
    activePowerW: number;
    powerFactor: number;
    energyWh: number;
    simulated?: boolean;
  },
  extras?: Partial<SnapshotInput>,
): SnapshotInput {
  return {
    recordedAt: reading.recordedAt,
    voltageV: reading.voltageV,
    currentA: reading.currentA,
    frequencyHz: reading.frequencyHz,
    activePowerW: reading.activePowerW,
    powerFactor: reading.powerFactor,
    importEnergyKwh: reading.energyWh / 1000,
    solarPowerW: extras?.solarPowerW,
    batterySocPct: extras?.batterySocPct,
    batteryPowerW: extras?.batteryPowerW,
    exportEnergyKwh: extras?.exportEnergyKwh,
    gridAvailable: extras?.gridAvailable ?? true,
    inverterStatus: extras?.inverterStatus,
    peakDemandW: extras?.peakDemandW ?? reading.activePowerW,
    metadata: {
      simulated: Boolean(reading.simulated),
      ...(extras?.metadata ?? {}),
    },
  };
}

export function snapshotExtrasFromBag(bag: Record<string, number | boolean | string>): Partial<SnapshotInput> {
  const num = (k: string) => {
    const v = bag[k];
    return typeof v === "number" ? v : undefined;
  };
  return {
    solarPowerW: num("solar_power") ?? num("solarPowerW"),
    batterySocPct: num("battery_soc") ?? num("batterySocPct"),
    batteryPowerW: num("battery_power") ?? num("batteryPowerW"),
    exportEnergyKwh: num("export_energy_kwh") ?? num("exportEnergyKwh"),
    importEnergyKwh: num("import_energy_kwh") ?? num("importEnergyKwh"),
    inverterStatus: typeof bag.inverter_status === "string" ? bag.inverter_status : undefined,
    gridAvailable: typeof bag.grid_available === "boolean" ? bag.grid_available : undefined,
  };
}
