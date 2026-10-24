import { z } from "zod";
import type { NormalizedTelemetry, ProtocolAdapter, ValidationResult } from "@/lib/protocols/types";
import { normalizeUniversalPayload } from "@/lib/protocols/normalize";

export const mqttConfigSchema = z.object({
  brokerUrl: z.string().url(),
  port: z.number().int().min(1).max(65535).optional(),
  clientId: z.string().min(1).max(128).optional(),
  username: z.string().max(128).optional(),
  passwordRef: z.string().max(128).optional(),
  topicNamespace: z.string().min(1).max(256),
  telemetryTopic: z.string().min(1).max(256),
  statusTopic: z.string().max(256).optional(),
  commandTopic: z.string().max(256).optional(),
  ackTopic: z.string().max(256).optional(),
  qos: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(1),
  tls: z.boolean().default(true),
  rejectUnauthorized: z.boolean().default(true),
  useRetained: z.boolean().default(false),
});

export type MqttConfig = z.infer<typeof mqttConfigSchema>;

function validate(config: unknown): ValidationResult {
  const parsed = mqttConfigSchema.safeParse(config);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      warnings: [],
    };
  }
  const warnings: string[] = [];
  if (!parsed.data.tls) {
    warnings.push("TLS is disabled. Use TLS for production MQTT.");
  }
  if (!parsed.data.brokerUrl.startsWith("mqtts://") && !parsed.data.brokerUrl.startsWith("wss://") && parsed.data.tls) {
    warnings.push("Prefer mqtts:// or wss:// broker URLs when TLS is enabled.");
  }
  warnings.push(
    "Persistent MQTT subscriptions must run in the gateway/worker service, not on Vercel serverless functions.",
  );
  return { ok: true, errors: [], warnings };
}

export const mqttAdapter: ProtocolAdapter = {
  id: "mqtt",
  descriptor: {
    id: "mqtt",
    name: "MQTT",
    status: "gateway_required",
    description: "MQTT over TLS with per-tenant topic namespaces, telemetry, status, and command topics.",
    capabilities: {
      discovery: false,
      telemetryRead: true,
      commands: true,
      writes: false,
      healthCheck: true,
      requiresGateway: true,
    },
    notes: [
      "Cloud app validates config and ingests normalized payloads via HTTP from the gateway bridge.",
      "Do not open long-lived MQTT clients inside serverless request handlers.",
    ],
  },
  validateConfig: validate,
  normalizeTelemetry(raw: unknown, deviceId: string): NormalizedTelemetry {
    return normalizeUniversalPayload(raw, deviceId, "mqtt");
  },
  async testConnectivity(config: unknown) {
    const result = validate(config);
    if (!result.ok) {
      return { ok: false, message: result.errors.join("; "), checkedAt: new Date().toISOString() };
    }
    return {
      ok: true,
      message:
        "MQTT config is valid. Live broker connect/subscribe must be performed by the gateway agent with credentials.",
      checkedAt: new Date().toISOString(),
    };
  },
};
