import { z } from "zod";
import { currencySchema, timezoneSchema } from "@/lib/validation/common";

export const siteCreateSchema = z.object({
  name: z.string().min(1).max(120),
  timezone: timezoneSchema.default("UTC"),
  currency: currencySchema.default("USD"),
});

export const circuitCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  phaseLabel: z.string().max(32).optional(),
});

export const deviceCreateSchema = z.object({
  name: z.string().min(1).max(120),
  circuitId: z.string().cuid().optional(),
  sensorModel: z.string().max(64).default("PZEM-004T-V3"),
  staleAfterSeconds: z.number().int().min(30).max(3600).optional(),
  category: z
    .enum([
      "ESP32",
      "ESP8266",
      "RASPBERRY_PI",
      "PLC",
      "SMART_METER",
      "POWER_ANALYZER",
      "SOLAR_INVERTER",
      "BMS",
      "CHARGE_CONTROLLER",
      "SMART_GRID",
      "SENSOR",
      "RELAY",
      "ACTUATOR",
      "IO_MODULE",
      "GATEWAY",
      "BMS_MESH",
      "CUSTOM",
    ])
    .optional(),
  protocol: z
    .enum([
      "MQTT",
      "HTTP",
      "WEBSOCKET",
      "MODBUS_TCP",
      "MODBUS_RTU",
      "OPC_UA",
      "BACNET_IP",
      "LORAWAN",
      "ZIGBEE",
      "THREAD",
      "BLE",
      "CAN",
      "VENDOR_API",
      "CUSTOM",
    ])
    .optional(),
  manufacturer: z.string().max(120).optional(),
  model: z.string().max(120).optional(),
  gatewayId: z.string().cuid().optional(),
  profileId: z.string().cuid().optional(),
  demoMode: z.boolean().optional(),
  writeEnabled: z.boolean().optional(),
  connectionConfig: z.record(z.string(), z.unknown()).optional(),
  capabilities: z.record(z.string(), z.unknown()).optional(),
  measurementDefs: z
    .array(
      z.object({
        key: z.string().min(1).max(64),
        label: z.string().min(1).max(120),
        unit: z.string().max(32).optional(),
        valueType: z.enum(["NUMBER", "BOOLEAN", "ENUM", "STRING"]).default("NUMBER"),
        scale: z.number().finite().default(1),
        writable: z.boolean().default(false),
      }),
    )
    .max(128)
    .optional(),
});

export const protocolTestSchema = z.object({
  protocol: z.string().min(1),
  config: z.record(z.string(), z.unknown()),
});

export const gatewayCreateSchema = z.object({
  name: z.string().min(1).max(120),
  platform: z.string().max(64).default("raspberry-pi"),
});

export const gatewayHeartbeatSchema = z.object({
  agentVersion: z.string().max(64).optional(),
  cpuPercent: z.number().min(0).max(100).optional(),
  memPercent: z.number().min(0).max(100).optional(),
  diskPercent: z.number().min(0).max(100).optional(),
  uptimeSec: z.number().int().min(0).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const automationRuleCreateSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(["MONITORING", "ADVISORY", "CONTROL"]).default("MONITORING"),
  enabled: z.boolean().default(true),
  dryRunDefault: z.boolean().default(true),
  requireApproval: z.boolean().default(false),
  triggerJson: z.record(z.string(), z.unknown()),
  conditionsJson: z.record(z.string(), z.unknown()),
  actionsJson: z.array(z.record(z.string(), z.unknown())).min(1),
  scheduleCron: z.string().max(120).optional(),
  retryPolicyJson: z.record(z.string(), z.unknown()).optional(),
});

export const automationSimulateSchema = z.object({
  measurements: z.record(z.string(), z.union([z.number(), z.boolean(), z.string()])),
  deviceConnected: z.boolean().optional(),
  dryRun: z.boolean().default(true),
});

export const universalTelemetrySchema = z.object({
  deviceId: z.string().min(8).max(64).optional(),
  device_id: z.string().min(8).max(64).optional(),
  eventId: z.string().uuid().optional(),
  recorded_at: z.string().datetime().optional(),
  timestamp: z.string().datetime().optional(),
  protocol: z.string().optional(),
  schema_version: z.number().int().optional(),
  measurements: z
    .array(
      z.object({
        key: z.string().min(1).max(64),
        value: z.union([z.number(), z.boolean(), z.string()]),
        unit: z.string().max(32).optional(),
        quality: z.string().optional(),
        scale: z.number().optional(),
      }),
    )
    .min(1)
    .max(256),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const tariffCreateSchema = z.object({
  name: z.string().min(1).max(120),
  currency: currencySchema,
  ratePerKwh: z.number().positive().max(1000),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional(),
});

export const alertRuleSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum([
    "OVERVOLTAGE",
    "UNDERVOLTAGE",
    "OVERCURRENT",
    "EXCESSIVE_POWER",
    "HIGH_ENERGY",
    "DEVICE_STALE",
    "DEVICE_OFFLINE",
    "INVALID_MEASUREMENT",
    "CUSTOM",
  ]),
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]).default("WARNING"),
  enabled: z.boolean().default(true),
  voltageHighV: z.number().positive().optional(),
  voltageLowV: z.number().positive().optional(),
  currentHighA: z.number().positive().optional(),
  powerHighW: z.number().positive().optional(),
  energyHighKwh: z.number().positive().optional(),
  hysteresisPercent: z.number().min(0).max(50).default(2),
  sustainSeconds: z.number().int().min(0).max(3600).default(30),
  cooldownSeconds: z.number().int().min(0).max(86400).default(300),
});

export const ackSchema = z.object({
  note: z.string().max(500).optional(),
});

export const commandSchema = z.object({
  type: z.enum(["REQUEST_STATUS", "ROTATE_CREDENTIAL"]),
  payload: z.record(z.string(), z.unknown()).optional(),
  expiresInSeconds: z.number().int().min(30).max(86400).default(300),
});
