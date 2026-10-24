import { z } from "zod";
import type { ProtocolAdapter, ValidationResult } from "@/lib/protocols/types";
import { normalizeUniversalPayload } from "@/lib/protocols/normalize";

export const httpConfigSchema = z.object({
  mode: z.enum(["ingest", "poll", "webhook"]).default("ingest"),
  baseUrl: z.string().url().optional(),
  pollPath: z.string().max(512).optional(),
  pollIntervalSec: z.number().int().min(5).max(3600).optional(),
  webhookSecretRef: z.string().max(128).optional(),
  timeoutMs: z.number().int().min(500).max(30_000).default(5000),
  retryMax: z.number().int().min(0).max(5).default(2),
});

function validate(config: unknown): ValidationResult {
  const parsed = httpConfigSchema.safeParse(config);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`), warnings: [] };
  }
  const warnings: string[] = [];
  if (parsed.data.mode === "poll" && !parsed.data.baseUrl) {
    return { ok: false, errors: ["baseUrl is required for poll mode"], warnings };
  }
  if (parsed.data.mode === "poll") {
    warnings.push("Outbound polling should run from the gateway/worker, not serverless cron loops for high frequency.");
  }
  return { ok: true, errors: [], warnings };
}

export const httpAdapter: ProtocolAdapter = {
  id: "http",
  descriptor: {
    id: "http",
    name: "HTTP / REST",
    status: "implemented",
    description: "Authenticated HTTPS telemetry ingestion, optional signed webhooks, and gateway-side polling.",
    capabilities: {
      discovery: false,
      telemetryRead: true,
      commands: true,
      writes: false,
      healthCheck: true,
      requiresGateway: false,
    },
    notes: ["Primary cloud ingestion path for ESP32/ESP8266 firmware and gateway relays."],
  },
  validateConfig: validate,
  normalizeTelemetry: (raw, deviceId) => normalizeUniversalPayload(raw, deviceId, "http"),
  async testConnectivity(config) {
    const result = validate(config);
    return {
      ok: result.ok,
      message: result.ok ? "HTTP integration config is valid." : result.errors.join("; "),
      checkedAt: new Date().toISOString(),
    };
  },
};
