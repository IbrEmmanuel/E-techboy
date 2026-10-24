import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { authenticateDevice } from "@/lib/auth/device";
import { handleRouteError, jsonOk } from "@/lib/http";
import { clientKey, enforceRateLimit } from "@/lib/security/rate-limit";
import { ingestUniversalTelemetry } from "@/lib/telemetry/universal-ingest";
import { universalTelemetrySchema } from "@/lib/validation/resources";

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(clientKey(request, "telemetry-universal"), 180, 60 * 1000);
    const device = await authenticateDevice(request.headers.get("authorization"));
    const body = await request.json();
    const parsed = universalTelemetrySchema.parse(body);
    const eventId = parsed.eventId ?? randomUUID();
    const result = await ingestUniversalTelemetry(device, { ...body, eventId }, eventId);
    if (!result.duplicate) {
      const { publishRealtime } = await import("@/lib/realtime/publish");
      void publishRealtime({
        type: "universal",
        siteId: device.siteId,
        deviceId: device.id,
        publicId: device.publicId,
        at: new Date().toISOString(),
        payload: { eventId, measurementCount: result.count, transport: "http" },
      });
    }
    return jsonOk(
      {
        accepted: true,
        duplicate: result.duplicate,
        eventId,
        measurementCount: result.count,
        note: "Universal normalized telemetry stored. Legacy /api/v1/telemetry remains for ESP energy meters.",
        realtime: "websocket-fanout",
      },
      result.duplicate ? 200 : 201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
