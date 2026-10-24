import { z } from "zod";
import type { ProtocolAdapter, ValidationResult } from "@/lib/protocols/types";
import { normalizeUniversalPayload } from "@/lib/protocols/normalize";

const schema = z.object({
  name: z.string().min(1).max(120),
  ingestPath: z.literal("/api/v1/telemetry/universal").default("/api/v1/telemetry/universal"),
  notes: z.string().max(2000).optional(),
});

function validate(config: unknown): ValidationResult {
  const parsed = schema.safeParse(config);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`), warnings: [] };
  }
  return {
    ok: true,
    errors: [],
    warnings: ["Custom devices must publish the normalized telemetry contract over authenticated HTTPS or gateway MQTT bridge."],
  };
}

export const customAdapter: ProtocolAdapter = {
  id: "custom",
  descriptor: {
    id: "custom",
    name: "Custom Device",
    status: "implemented",
    description: "Documented API / normalized telemetry contract for custom hardware.",
    capabilities: {
      discovery: false,
      telemetryRead: true,
      commands: true,
      writes: false,
      healthCheck: true,
      requiresGateway: false,
    },
    notes: ["Compatibility depends on firmware implementing the documented payload schema."],
  },
  validateConfig: validate,
  normalizeTelemetry: (raw, deviceId) => normalizeUniversalPayload(raw, deviceId, "custom"),
  async testConnectivity(config) {
    const result = validate(config);
    return {
      ok: result.ok,
      message: result.ok ? "Custom integration config valid." : result.errors.join("; "),
      checkedAt: new Date().toISOString(),
    };
  },
};
