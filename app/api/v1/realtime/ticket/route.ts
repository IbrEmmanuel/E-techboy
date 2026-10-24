import { SignJWT } from "jose";
import { requireUser } from "@/lib/auth/session";
import { requireSiteRole } from "@/lib/auth/access";
import { getEnv } from "@/lib/env";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

/**
 * Issues a short-lived ticket for browser WebSocket subscription to a site.
 * Devices use their bearer token directly on the realtime server instead.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json().catch(() => ({}))) as { siteId?: string };
    const siteId = body.siteId;
    if (!siteId) return jsonError("VALIDATION_ERROR", "siteId is required", 400);
    await requireSiteRole(user, siteId);

    const env = getEnv();
    const port = process.env.REALTIME_PORT ?? "3001";
    const publicWs =
      process.env.NEXT_PUBLIC_REALTIME_WS_URL ??
      `ws://127.0.0.1:${port}`;

    const ticket = await new SignJWT({
      sub: user.id,
      siteId,
      purpose: "realtime",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("2m")
      .sign(new TextEncoder().encode(env.AUTH_SECRET));

    return jsonOk({
      ticket,
      expiresInSeconds: 120,
      wsUrl: `${publicWs.replace(/\/$/, "")}/live`,
      protocol: "websocket",
      note: "Connect with ?ticket=&siteId=. Re-fetch a ticket before expiry.",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET() {
  try {
    await requireUser();
    const port = process.env.REALTIME_PORT ?? "3001";
    const publicWs =
      process.env.NEXT_PUBLIC_REALTIME_WS_URL ??
      `ws://127.0.0.1:${port}`;
    return jsonOk({
      enabled: true,
      wsUrl: publicWs,
      devicePath: "/device",
      livePath: "/live",
      mechanism: "websocket",
      note: "Hardware devices: ws://host:port/device with Bearer device token. Dashboard: POST /api/v1/realtime/ticket then /live.",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
