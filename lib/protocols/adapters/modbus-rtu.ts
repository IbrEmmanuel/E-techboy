import { z } from "zod";
import type { ProtocolAdapter, ValidationResult } from "@/lib/protocols/types";

const registerSchema = z.object({
  key: z.string().min(1).max(64),
  address: z.number().int().min(0).max(65535),
  count: z.number().int().min(1).max(4).optional(),
  type: z.enum(["uint16", "int16", "uint32", "int32", "float32", "boolean"]),
  scale: z.number().finite().optional(),
  unit: z.string().max(32).optional(),
  writable: z.boolean().optional(),
});

export const modbusRtuConfigSchema = z.object({
  serialPort: z.string().min(1).max(128),
  baudRate: z.number().int().positive().default(9600),
  parity: z.enum(["none", "even", "odd"]).default("none"),
  stopBits: z.union([z.literal(1), z.literal(2)]).default(1),
  dataBits: z.union([z.literal(7), z.literal(8)]).default(8),
  slaveId: z.number().int().min(1).max(247).default(1),
  pollIntervalMs: z.number().int().min(500).max(3600_000).default(5000),
  byteOrder: z.enum(["BE", "LE"]).default("BE"),
  wordOrder: z.enum(["AB", "BA"]).default("AB"),
  writeEnabled: z.boolean().default(false),
  registers: z.array(registerSchema).min(1).max(256),
});

function validate(config: unknown): ValidationResult {
  const parsed = modbusRtuConfigSchema.safeParse(config);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`), warnings: [] };
  }
  return {
    ok: true,
    errors: [],
    warnings: [
      "Modbus RTU requires a local gateway with USB/serial adapter access.",
      "Browsers cannot open host serial ports for industrial polling.",
      "Document RS-485 wiring, termination, and isolation before commissioning.",
    ],
  };
}

export const modbusRtuAdapter: ProtocolAdapter = {
  id: "modbus_rtu",
  descriptor: {
    id: "modbus_rtu",
    name: "Modbus RTU",
    status: "gateway_required",
    description: "Serial Modbus via local gateway agent (port, baud, parity, slave ID, register map).",
    capabilities: {
      discovery: false,
      telemetryRead: true,
      commands: true,
      writes: true,
      healthCheck: true,
      requiresGateway: true,
    },
    notes: ["USB/RS-485 adapter required on the gateway host."],
  },
  validateConfig: validate,
  async testConnectivity(config) {
    const result = validate(config);
    return {
      ok: result.ok,
      message: result.ok
        ? "Modbus RTU config valid. Serial open/poll must run on the gateway agent."
        : result.errors.join("; "),
      checkedAt: new Date().toISOString(),
    };
  },
};
