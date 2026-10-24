/**
 * Live hardware + dashboard WebSocket server.
 *
 * Device:  ws://host:3001/device  Authorization: Bearer <publicId.secret>
 *          or ?token=<publicId.secret>
 * UI:      ws://host:3001/live?ticket=<jwt>&siteId=<id>
 * Publish: POST /internal/publish  (from Next.js after HTTP ingest)
 *
 * Devices stream telemetry over WebSocket; server forwards to HTTP ingest APIs
 * (same validation/alerts/automation) then pushes updates to subscribed UIs.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import { jwtVerify } from "jose";
import { PrismaClient } from "@prisma/client";

const port = Number(process.env.REALTIME_PORT ?? 3001);
const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const authSecret = process.env.AUTH_SECRET ?? "";
const internalSecret = process.env.REALTIME_INTERNAL_SECRET ?? authSecret;

if (!authSecret || authSecret.length < 32) {
  console.error("[realtime] AUTH_SECRET (min 32 chars) is required");
  process.exit(1);
}

const prisma = new PrismaClient();

type SiteClient = { ws: WebSocket; siteId: string; userId: string };
type DeviceClient = { ws: WebSocket; deviceId: string; publicId: string; siteId: string; token: string };

const siteClients = new Set<SiteClient>();
const deviceClients = new Set<DeviceClient>();

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function send(ws: WebSocket, data: unknown) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(data));
}

function broadcastSite(siteId: string, event: unknown) {
  const payload = JSON.stringify(event);
  for (const client of siteClients) {
    if (client.siteId === siteId && client.ws.readyState === client.ws.OPEN) {
      client.ws.send(payload);
    }
  }
}

async function authenticateDeviceToken(token: string) {
  const [publicId, secret] = token.split(".");
  if (!publicId || !secret) return null;
  const device = await prisma.device.findUnique({ where: { publicId } });
  if (!device || device.status === "REVOKED" || device.credentialRevokedAt) return null;
  if (!safeEqual(device.credentialHash, sha256(secret))) return null;
  return device;
}

async function verifyLiveTicket(ticket: string, siteId: string) {
  const { payload } = await jwtVerify(ticket, new TextEncoder().encode(authSecret));
  if (payload.purpose !== "realtime") throw new Error("Invalid ticket purpose");
  if (payload.siteId !== siteId) throw new Error("Ticket site mismatch");
  if (typeof payload.sub !== "string") throw new Error("Invalid subject");
  return { userId: payload.sub, siteId };
}

async function forwardTelemetry(token: string, body: unknown, kind: "legacy" | "universal") {
  const path = kind === "legacy" ? "/api/v1/telemetry" : "/api/v1/telemetry/universal";
  const res = await fetch(`${appUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-realtime-secret",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

  if (req.method === "OPTIONS") {
    json(res, 204, {});
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    json(res, 200, {
      status: "ok",
      service: "realtime-websocket",
      port,
      devicesConnected: deviceClients.size,
      liveClients: siteClients.size,
      appUrl,
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/internal/publish") {
    const secret = req.headers["x-realtime-secret"];
    if (secret !== internalSecret) {
      json(res, 401, { error: "unauthorized" });
      return;
    }
    try {
      const raw = await readBody(req);
      const event = JSON.parse(raw) as { siteId?: string; type?: string };
      if (!event.siteId) {
        json(res, 400, { error: "siteId required" });
        return;
      }
      broadcastSite(event.siteId, { ...event, channel: "site" });
      json(res, 200, { ok: true, delivered: true });
    } catch (error) {
      json(res, 400, { error: error instanceof Error ? error.message : "bad request" });
    }
    return;
  }

  json(res, 404, { error: "not found", hint: "Use WebSocket /device or /live" });
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
  if (url.pathname !== "/device" && url.pathname !== "/live") {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req, url.pathname);
  });
});

wss.on("connection", (ws: WebSocket, req: IncomingMessage, pathname: string) => {
  void (async () => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

    if (pathname === "/device") {
      const auth = req.headers.authorization;
      const token =
        (auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null) ?? url.searchParams.get("token");
      if (!token) {
        send(ws, { type: "error", code: "UNAUTHENTICATED", message: "Device bearer token required" });
        ws.close(4401, "unauthorized");
        return;
      }
      const device = await authenticateDeviceToken(token);
      if (!device) {
        send(ws, { type: "error", code: "UNAUTHENTICATED", message: "Invalid device token" });
        ws.close(4401, "unauthorized");
        return;
      }

      const client: DeviceClient = {
        ws,
        deviceId: device.id,
        publicId: device.publicId,
        siteId: device.siteId,
        token,
      };
      deviceClients.add(client);

      // Register handlers before any await so early frames are not dropped.
      ws.on("message", (raw) => {
        void (async () => {
          try {
            const msg = JSON.parse(String(raw)) as Record<string, unknown>;
            const type = typeof msg.type === "string" ? msg.type : "telemetry";

            if (type === "ping") {
              send(ws, { type: "pong", at: new Date().toISOString() });
              return;
            }

            if (type === "universal") {
              const body = { ...msg };
              delete body.type;
              const result = await forwardTelemetry(token, body, "universal");
              send(ws, { type: "ack", kind: "universal", ...result });
              if (result.ok) {
                broadcastSite(device.siteId, {
                  type: "universal",
                  siteId: device.siteId,
                  deviceId: device.id,
                  publicId: device.publicId,
                  at: new Date().toISOString(),
                  payload: result.json as Record<string, unknown>,
                });
              }
              return;
            }

            const body = { ...msg };
            delete body.type;
            if (!body.deviceId) body.deviceId = device.publicId;
            const result = await forwardTelemetry(token, body, "legacy");
            send(ws, { type: "ack", kind: "telemetry", ...result });
            if (result.ok) {
              broadcastSite(device.siteId, {
                type: "telemetry",
                siteId: device.siteId,
                deviceId: device.id,
                publicId: device.publicId,
                at: new Date().toISOString(),
                payload: result.json as Record<string, unknown>,
              });
            }
          } catch (error) {
            send(ws, {
              type: "error",
              code: "BAD_MESSAGE",
              message: error instanceof Error ? error.message : "Invalid message",
            });
          }
        })();
      });

      ws.on("close", () => {
        deviceClients.delete(client);
        void prisma.device
          .update({
            where: { id: device.id },
            data: { connectionState: "DISCONNECTED" },
          })
          .then(() => {
            broadcastSite(device.siteId, {
              type: "device_status",
              siteId: device.siteId,
              deviceId: device.id,
              publicId: device.publicId,
              at: new Date().toISOString(),
              payload: { connectionState: "DISCONNECTED", transport: "websocket" },
            });
          })
          .catch(() => undefined);
      });

      await prisma.device.update({
        where: { id: device.id },
        data: { connectionState: "CONNECTED", lastSeenAt: new Date(), protocol: "WEBSOCKET" },
      });

      send(ws, {
        type: "welcome",
        role: "device",
        publicId: device.publicId,
        protocol: "websocket",
        ingest: ["telemetry", "universal", "ping"],
        note: "Send JSON { type:\"telemetry\", ...legacyFields } or { type:\"universal\", ... }",
      });

      broadcastSite(device.siteId, {
        type: "device_status",
        siteId: device.siteId,
        deviceId: device.id,
        publicId: device.publicId,
        at: new Date().toISOString(),
        payload: { connectionState: "CONNECTED", transport: "websocket" },
      });
      return;
    }

    // /live — dashboard subscribers
    const ticket = url.searchParams.get("ticket");
    const siteId = url.searchParams.get("siteId");
    if (!ticket || !siteId) {
      send(ws, { type: "error", code: "VALIDATION_ERROR", message: "ticket and siteId required" });
      ws.close(4400, "bad request");
      return;
    }
    try {
      const auth = await verifyLiveTicket(ticket, siteId);
      const client: SiteClient = { ws, siteId: auth.siteId, userId: auth.userId };
      siteClients.add(client);
      send(ws, {
        type: "welcome",
        role: "live",
        siteId: auth.siteId,
        protocol: "websocket",
        note: "Subscribed to live site events. HTTP polling remains as fallback.",
      });
      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(String(raw)) as { type?: string };
          if (msg.type === "ping") send(ws, { type: "pong", at: new Date().toISOString() });
        } catch {
          // ignore
        }
      });
      ws.on("close", () => siteClients.delete(client));
    } catch (error) {
      send(ws, {
        type: "error",
        code: "UNAUTHENTICATED",
        message: error instanceof Error ? error.message : "Invalid ticket",
      });
      ws.close(4401, "unauthorized");
    }
  })();
});

server.listen(port, () => {
  console.info(`[realtime] WebSocket live server on ws://127.0.0.1:${port}`);
  console.info(`[realtime] Device:  ws://127.0.0.1:${port}/device?token=<publicId.secret>`);
  console.info(`[realtime] Live UI: ws://127.0.0.1:${port}/live?ticket=...&siteId=...`);
  console.info(`[realtime] Forwarding ingest to ${appUrl}`);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
