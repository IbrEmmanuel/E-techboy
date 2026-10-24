import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    const port = process.env.REALTIME_PORT ?? "3001";
    const realtimeBase = process.env.REALTIME_INTERNAL_URL ?? `http://127.0.0.1:${port}`;
    let websocket: { status: string; devicesConnected?: number; liveClients?: number } = {
      status: "down",
    };
    try {
      const res = await fetch(`${realtimeBase.replace(/\/$/, "")}/health`, {
        signal: AbortSignal.timeout(1200),
      });
      if (res.ok) {
        const body = (await res.json()) as {
          devicesConnected?: number;
          liveClients?: number;
        };
        websocket = {
          status: "up",
          devicesConnected: body.devicesConnected,
          liveClients: body.liveClients,
        };
      }
    } catch {
      websocket = { status: "down" };
    }

    return jsonOk({
      status: "ok",
      database: "up",
      time: new Date().toISOString(),
      realtime: {
        mechanism: websocket.status === "up" ? "websocket+polling" : "authenticated-polling",
        websocket,
        defaultIntervalMs: Number(process.env.LIVE_POLL_INTERVAL_MS ?? 8000),
        deviceWs: `ws://127.0.0.1:${port}/device`,
        liveWs: `ws://127.0.0.1:${port}/live`,
        note:
          websocket.status === "up"
            ? "Hardware can stream over WebSocket; dashboard subscribes via ticket. HTTP ingest APIs remain supported."
            : "WebSocket realtime server is down — start with npm run realtime. HTTP ingest + polling still work.",
      },
    });
  } catch {
    return jsonError("DATABASE_UNAVAILABLE", "Database is unreachable", 503);
  }
}
