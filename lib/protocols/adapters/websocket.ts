import { z } from "zod";
import type { ProtocolAdapter, ValidationResult } from "@/lib/protocols/types";
import { normalizeUniversalPayload } from "@/lib/protocols/normalize";

const schema = z.object({
  url: z.string().url().optional(),
  path: z.string().default("/device"),
  authTokenRef: z.string().max(128).optional(),
  reconnectMs: z.number().int().min(500).max(60_000).default(3000),
});

function validate(config: unknown): ValidationResult {
  const parsed = schema.safeParse(config ?? {});
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`), warnings: [] };
  }
  return {
    ok: true,
    errors: [],
    warnings: [],
  };
}

export const websocketAdapter: ProtocolAdapter = {
  id: "websocket",
  descriptor: {
    id: "websocket",
    name: "WebSocket",
    status: "implemented",
    description:
      "Live authenticated WebSocket ingest for hardware devices, plus dashboard live subscriptions via short-lived tickets.",
    capabilities: {
      discovery: false,
      telemetryRead: true,
      commands: true,
      writes: false,
      healthCheck: true,
      requiresGateway: false,
    },
    notes: [
      "Device endpoint: ws://<realtime-host>/device with Bearer <publicId.secret>",
      "Send { type:\"telemetry\", ... } (legacy energy) or { type:\"universal\", ... }",
      "Dashboard clients use POST /api/v1/realtime/ticket then /live",
      "Run `npm run realtime` alongside Next.js (not available inside Vercel serverless functions)",
    ],
  },
  validateConfig: validate,
  normalizeTelemetry: (raw, deviceId) => normalizeUniversalPayload(raw, deviceId, "websocket"),
  async testConnectivity(config) {
    const result = validate(config);
    if (!result.ok) {
      return { ok: false, message: result.errors.join("; "), checkedAt: new Date().toISOString() };
    }
    const port = process.env.REALTIME_PORT ?? "3001";
    const base = process.env.REALTIME_INTERNAL_URL ?? `http://127.0.0.1:${port}`;
    try {
      const res = await fetch(`${base.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) {
        return {
          ok: false,
          message: `Realtime WebSocket server returned ${res.status}. Start it with npm run realtime.`,
          checkedAt: new Date().toISOString(),
        };
      }
      const body = (await res.json()) as { devicesConnected?: number };
      return {
        ok: true,
        message: `Live WebSocket server reachable (${body.devicesConnected ?? 0} device socket(s) connected).`,
        checkedAt: new Date().toISOString(),
      };
    } catch {
      return {
        ok: false,
        message: "Realtime WebSocket server unreachable. Run `npm run realtime` on port 3001.",
        checkedAt: new Date().toISOString(),
      };
    }
  },
};
