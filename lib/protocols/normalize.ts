import { z } from "zod";
import type {
  MeasurementQuality,
  NormalizedMeasurement,
  NormalizedTelemetry,
  ProtocolId,
} from "@/lib/protocols/types";

const qualitySchema = z.enum(["good", "estimated", "suspect", "invalid", "GOOD", "ESTIMATED", "SUSPECT", "INVALID"]);

const measurementSchema = z.object({
  key: z.string().min(1).max(64),
  value: z.union([z.number(), z.boolean(), z.string()]),
  unit: z.string().max(32).optional(),
  quality: qualitySchema.optional(),
  scale: z.number().finite().optional(),
});

const universalSchema = z.object({
  device_id: z.string().min(1).max(64).optional(),
  deviceId: z.string().min(1).max(64).optional(),
  protocol: z.string().optional(),
  recorded_at: z.string().datetime().optional(),
  timestamp: z.string().datetime().optional(),
  schema_version: z.number().int().min(1).max(32).optional(),
  schemaVersion: z.number().int().min(1).max(32).optional(),
  measurements: z.array(measurementSchema).min(1).max(256),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const legacyEnergySchema = z.object({
  deviceId: z.string().min(1),
  timestamp: z.string().datetime(),
  measurements: z.object({
    voltageV: z.number(),
    currentA: z.number(),
    activePowerW: z.number(),
    powerFactor: z.number().optional(),
    frequencyHz: z.number().optional(),
    energyWh: z.number().optional(),
    energyKwh: z.number().optional(),
    quality: z.string().optional(),
  }),
  firmwareVersion: z.string().optional(),
  simulated: z.boolean().optional(),
});

function mapQuality(q?: string): MeasurementQuality | undefined {
  if (!q) return undefined;
  const lower = q.toLowerCase() as MeasurementQuality;
  if (["good", "estimated", "suspect", "invalid"].includes(lower)) return lower;
  return "suspect";
}

export function applyScale(value: number | boolean | string, scale?: number): number | boolean | string {
  if (typeof value !== "number" || scale === undefined || scale === 1) return value;
  return value * scale;
}

export function normalizeUniversalPayload(
  raw: unknown,
  deviceId: string,
  protocol: ProtocolId,
): NormalizedTelemetry {
  const legacy = legacyEnergySchema.safeParse(raw);
  if (legacy.success) {
    const m = legacy.data.measurements;
    const quality = mapQuality(m.quality) ?? "good";
    const measurements: NormalizedMeasurement[] = [
      { key: "voltage", value: m.voltageV, unit: "V", quality },
      { key: "current", value: m.currentA, unit: "A", quality },
      { key: "active_power", value: m.activePowerW, unit: "W", quality },
    ];
    if (m.powerFactor !== undefined) measurements.push({ key: "power_factor", value: m.powerFactor, unit: "1", quality });
    if (m.frequencyHz !== undefined) measurements.push({ key: "frequency", value: m.frequencyHz, unit: "Hz", quality });
    if (m.energyWh !== undefined) measurements.push({ key: "energy", value: m.energyWh, unit: "Wh", quality });
    else if (m.energyKwh !== undefined) measurements.push({ key: "energy", value: m.energyKwh * 1000, unit: "Wh", quality });
    return {
      device_id: deviceId,
      protocol,
      recorded_at: legacy.data.timestamp,
      schema_version: 1,
      measurements,
      metadata: {
        firmware: legacy.data.firmwareVersion,
        simulated: legacy.data.simulated ?? false,
        source_format: "legacy_energy",
      },
    };
  }

  const parsed = universalSchema.parse(raw);
  const id = parsed.device_id ?? parsed.deviceId ?? deviceId;
  if (id !== deviceId) {
    throw new Error("device_id does not match authenticated device");
  }
  const recorded = parsed.recorded_at ?? parsed.timestamp;
  if (!recorded) {
    throw new Error("recorded_at or timestamp is required");
  }
  const recordedDate = new Date(recorded);
  if (Number.isNaN(recordedDate.getTime())) {
    throw new Error("Invalid recorded_at timestamp");
  }
  const now = Date.now();
  if (recordedDate.getTime() > now + 5 * 60_000) {
    throw new Error("Timestamp is too far in the future");
  }
  if (recordedDate.getTime() < now - 30 * 24 * 3600_000) {
    throw new Error("Timestamp is too stale (>30 days)");
  }

  return {
    device_id: deviceId,
    protocol,
    recorded_at: recorded,
    schema_version: parsed.schema_version ?? parsed.schemaVersion ?? 1,
    measurements: parsed.measurements.map((m) => ({
      key: m.key,
      value: applyScale(m.value, m.scale),
      unit: m.unit,
      quality: mapQuality(m.quality) ?? "good",
      scale: m.scale,
    })),
    metadata: parsed.metadata,
  };
}

export function qualityToDb(q?: MeasurementQuality): "GOOD" | "ESTIMATED" | "SUSPECT" | "INVALID" {
  switch (q) {
    case "estimated":
      return "ESTIMATED";
    case "suspect":
      return "SUSPECT";
    case "invalid":
      return "INVALID";
    default:
      return "GOOD";
  }
}
