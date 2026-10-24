import { NextRequest } from "next/server";
import { authenticateDevice } from "@/lib/auth/device";
import { ingestTelemetry } from "@/lib/ingest";
import { clientKey, enforceRateLimit } from "@/lib/security/rate-limit";
import { handleRouteError, jsonOk } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(clientKey(request, "telemetry"), 120, 60 * 1000);
    const device = await authenticateDevice(request.headers.get("authorization"));
    const body = await request.json();
    const result = await ingestTelemetry(device, body);
    if (!result.duplicate) {
      const { publishRealtime } = await import("@/lib/realtime/publish");
      void publishRealtime({
        type: "telemetry",
        siteId: device.siteId,
        deviceId: device.id,
        publicId: device.publicId,
        at: new Date().toISOString(),
        payload: {
          eventId: result.reading?.eventId,
          recordedAt: result.reading?.recordedAt,
          transport: "http",
        },
      });
    }
    return jsonOk({
      accepted: true,
      duplicate: result.duplicate,
      eventId: result.reading?.eventId,
      recordedAt: result.reading?.recordedAt,
      realtime: "websocket-fanout",
    }, result.duplicate ? 200 : 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
