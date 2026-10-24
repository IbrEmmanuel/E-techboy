import { z } from "zod";
import type { ProtocolAdapter, ValidationResult } from "@/lib/protocols/types";
import { normalizeUniversalPayload } from "@/lib/protocols/normalize";

const schema = z.object({
  vendor: z.string().min(1).max(120),
  apiBaseUrl: z.string().url(),
  authType: z.enum(["api_key", "oauth2", "basic"]).default("api_key"),
  credentialRef: z.string().min(1).max(128),
  deviceExternalId: z.string().min(1).max(128).optional(),
});

function validate(config: unknown): ValidationResult {
  const parsed = schema.safeParse(config);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`), warnings: [] };
  }
  return {
    ok: true,
    errors: [],
    warnings: [
      `Vendor "${parsed.data.vendor}" support depends on documented APIs and credentials.`,
      "Do not claim Siemens/Schneider/Rockwell/etc. compatibility without a validated driver per model.",
    ],
  };
}

export const vendorApiAdapter: ProtocolAdapter = {
  id: "vendor_api",
  descriptor: {
    id: "vendor_api",
    name: "Vendor API",
    status: "stub",
    description: "Extensible vendor cloud/API integrations for inverters, meters, and BMS platforms.",
    capabilities: {
      discovery: false,
      telemetryRead: true,
      commands: false,
      writes: false,
      healthCheck: true,
      requiresGateway: false,
    },
    notes: ["Each vendor requires its own adapter module and tests."],
  },
  validateConfig: validate,
  normalizeTelemetry: (raw, deviceId) => normalizeUniversalPayload(raw, deviceId, "vendor_api"),
  async testConnectivity(config) {
    const result = validate(config);
    return {
      ok: result.ok,
      message: result.ok
        ? "Vendor API config shape is valid. Live auth/API calls require vendor credentials and a dedicated adapter."
        : result.errors.join("; "),
      checkedAt: new Date().toISOString(),
    };
  },
};
