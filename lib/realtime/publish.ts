import "server-only";

import { getEnv } from "@/lib/env";

export type RealtimeEvent = {
  type: "telemetry" | "universal" | "alert" | "device_status" | "ping";
  siteId: string;
  deviceId?: string;
  publicId?: string;
  at: string;
  payload?: Record<string, unknown>;
};

/**
 * Fan-out to the dedicated WebSocket realtime process (non-blocking).
 * Safe no-op when the realtime server is down (HTTP polling still works).
 */
export async function publishRealtime(event: RealtimeEvent): Promise<void> {
  const env = getEnv();
  const base = process.env.REALTIME_INTERNAL_URL ?? `http://127.0.0.1:${process.env.REALTIME_PORT ?? "3001"}`;
  const secret = process.env.REALTIME_INTERNAL_SECRET ?? env.AUTH_SECRET;
  try {
    await fetch(`${base.replace(/\/$/, "")}/internal/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-realtime-secret": secret,
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // Realtime optional for serverless / cold starts
  }
}
