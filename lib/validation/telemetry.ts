import { z } from "zod";

export const UNITS = {
  voltage: "V",
  current: "A",
  activePower: "W",
  energy: "Wh",
  frequency: "Hz",
  powerFactor: "1",
} as const;

export const telemetryIngestSchema = z.object({
  deviceId: z.string().min(8).max(64),
  eventId: z.string().uuid(),
  timestamp: z.string().datetime(),
  schemaVersion: z.number().int().min(1).max(8),
  firmwareVersion: z.string().max(64).optional(),
  simulated: z.boolean().optional().default(false),
  sensorError: z.string().max(240).optional(),
  units: z
    .object({
      voltage: z.literal("V"),
      current: z.literal("A"),
      activePower: z.literal("W"),
      energy: z.enum(["Wh", "kWh"]),
      frequency: z.literal("Hz"),
      powerFactor: z.literal("1"),
    })
    .optional(),
  measurements: z.object({
    voltageV: z.number().min(0).max(1000),
    currentA: z.number().min(0).max(1000),
    activePowerW: z.number().min(0).max(1_000_000),
    powerFactor: z.number().min(0).max(1),
    frequencyHz: z.number().min(40).max(70),
    energyWh: z.number().min(0).max(1_000_000_000).optional(),
    energyKwh: z.number().min(0).max(1_000_000).optional(),
    quality: z.enum(["GOOD", "ESTIMATED", "SUSPECT", "INVALID"]).optional(),
  }),
}).refine((v) => v.measurements.energyWh !== undefined || v.measurements.energyKwh !== undefined, {
  message: "energyWh or energyKwh is required",
});

export type TelemetryIngest = z.infer<typeof telemetryIngestSchema>;

export function energyWhFromPayload(payload: TelemetryIngest): number {
  if (payload.measurements.energyWh !== undefined) return payload.measurements.energyWh;
  return (payload.measurements.energyKwh ?? 0) * 1000;
}
