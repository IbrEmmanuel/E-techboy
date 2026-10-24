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

export const modbusTcpConfigSchema = z.object({
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535).default(502),
  unitId: z.number().int().min(0).max(255).default(1),
  pollIntervalMs: z.number().int().min(500).max(3600_000).default(5000),
  byteOrder: z.enum(["BE", "LE"]).default("BE"),
  wordOrder: z.enum(["AB", "BA"]).default("AB"),
  timeoutMs: z.number().int().min(200).max(30_000).default(3000),
  writeEnabled: z.boolean().default(false),
  registers: z.array(registerSchema).min(1).max(256),
});

function validate(config: unknown): ValidationResult {
  const parsed = modbusTcpConfigSchema.safeParse(config);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`), warnings: [] };
  }
  const warnings: string[] = [
    "Modbus TCP polling runs on the gateway/worker. The cloud validates config and stores normalized readings.",
    "Default is read-only. Enable writeEnabled only with authorization and safety review.",
  ];
  if (parsed.data.writeEnabled && parsed.data.registers.some((r) => r.writable)) {
    warnings.push("Writable registers are configured. Commands require explicit allowlisting.");
  }
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|127\.)/.test(parsed.data.host) === false && !parsed.data.host.includes(".")) {
    // hostname ok
  }
  return { ok: true, errors: [], warnings };
}

export const modbusTcpAdapter: ProtocolAdapter = {
  id: "modbus_tcp",
  descriptor: {
    id: "modbus_tcp",
    name: "Modbus TCP",
    status: "gateway_required",
    description: "Configurable host, unit ID, register maps, scaling, byte/word order, and polling via gateway.",
    capabilities: {
      discovery: false,
      telemetryRead: true,
      commands: true,
      writes: true,
      healthCheck: true,
      requiresGateway: true,
    },
    notes: [
      "Do not expose PLC/Modbus ports to the public internet.",
      "Register decoding is implemented and unit-tested; live sockets require the gateway agent.",
    ],
  },
  validateConfig: validate,
  async testConnectivity(config) {
    const result = validate(config);
    return {
      ok: result.ok,
      message: result.ok
        ? "Modbus TCP config valid. Live register poll requires the local gateway on an authorized network."
        : result.errors.join("; "),
      checkedAt: new Date().toISOString(),
    };
  },
};
