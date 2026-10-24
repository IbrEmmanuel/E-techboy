import { markStaleDevices } from "@/lib/alerts/stale";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return jsonError("UNAUTHENTICATED", "Cron authentication failed", 401);
  }
  const result = await markStaleDevices();
  return jsonOk({ ok: true, ...result });
}
