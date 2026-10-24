/**
 * End-to-end verification: HTTP APIs + device WebSocket + live dashboard WebSocket.
 *   npx tsx scripts/test-live-api-ws.ts
 */
import WebSocket from "ws";

const APP = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const WS = (process.env.REALTIME_WS_URL ?? "ws://127.0.0.1:3001").replace(/\/$/, "");
const TOKEN = process.env.DEVICE_TOKEN ?? "esp32_demo000001.demo-device-secret-do-not-use-in-prod";
const EMAIL = "owner@example.com";
const PASSWORD = "ChangeMeNow1!";

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];

function pass(name: string, detail: string) {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name} — ${detail}`);
}
function fail(name: string, detail: string) {
  results.push({ name, ok: false, detail });
  console.error(`FAIL  ${name} — ${detail}`);
}

async function jsonFetch(path: string, init?: RequestInit & { cookie?: string }) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.cookie) headers.Cookie = init.cookie;
  const res = await fetch(`${APP}${path}`, { ...init, headers });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { res, body, text, setCookie: res.headers.getSetCookie?.() ?? [] };
}

function cookieJar(setCookies: string[]) {
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

function waitMessage(ws: WebSocket, predicate: (msg: Record<string, unknown>) => boolean, ms = 8000) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout waiting for WS message")), ms);
    const onMessage = (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(String(raw)) as Record<string, unknown>;
        if (predicate(msg)) {
          clearTimeout(timer);
          ws.off("message", onMessage);
          resolve(msg);
        }
      } catch {
        // ignore
      }
    };
    ws.on("message", onMessage);
  });
}

async function main() {
  // 1) Health
  {
    const { res, body } = await jsonFetch("/api/v1/health");
    const b = body as { status?: string; database?: string; realtime?: { mechanism?: string; websocket?: { status?: string } } };
    if (res.ok && b.status === "ok" && b.database === "up") {
      pass("GET /api/v1/health", `mechanism=${b.realtime?.mechanism} ws=${b.realtime?.websocket?.status}`);
    } else fail("GET /api/v1/health", JSON.stringify(body));
  }

  // 2) Realtime health
  {
    const res = await fetch(`${WS.replace("ws:", "http:")}/health`);
    const body = (await res.json()) as { status?: string; service?: string };
    if (res.ok && body.status === "ok") pass("GET realtime /health", body.service ?? "ok");
    else fail("GET realtime /health", JSON.stringify(body));
  }

  // 3) Login
  let cookie = "";
  let siteId = "";
  {
    const { res, body, setCookie } = await jsonFetch("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    cookie = cookieJar(setCookie);
    const b = body as { user?: { sites?: { id: string }[] } };
    // login may return user differently — also hit /me
    if (!res.ok) fail("POST /api/v1/auth/login", JSON.stringify(body));
    else pass("POST /api/v1/auth/login", `cookie=${cookie ? "yes" : "no"}`);

    const me = await jsonFetch("/api/v1/auth/me", { cookie });
    const mu = me.body as { user?: { sites?: { id: string; name: string }[] } };
    siteId = mu.user?.sites?.[0]?.id ?? "";
    if (me.res.ok && siteId) pass("GET /api/v1/auth/me", `site=${mu.user?.sites?.[0]?.name}`);
    else fail("GET /api/v1/auth/me", JSON.stringify(me.body));
  }

  // 4) HTTP legacy telemetry
  const eventId = crypto.randomUUID();
  {
    const payload = {
      deviceId: TOKEN.split(".")[0],
      eventId,
      timestamp: new Date().toISOString(),
      schemaVersion: 1,
      firmwareVersion: "api-test-1.0",
      simulated: true,
      measurements: {
        voltageV: 231.5,
        currentA: 1.25,
        activePowerW: 275.2,
        powerFactor: 0.97,
        frequencyHz: 50.02,
        energyWh: 19001.5,
        quality: "GOOD",
      },
    };
    const res = await fetch(`${APP}/api/v1/telemetry`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as { accepted?: boolean; realtime?: string };
    if (res.status === 201 && body.accepted) pass("POST /api/v1/telemetry", `realtime=${body.realtime}`);
    else fail("POST /api/v1/telemetry", `${res.status} ${JSON.stringify(body)}`);
  }

  // 5) HTTP universal
  {
    const res = await fetch(`${APP}/api/v1/telemetry/universal`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: TOKEN.split(".")[0],
        recorded_at: new Date().toISOString(),
        protocol: "http",
        measurements: [
          { key: "voltage", value: 231.5, unit: "V", quality: "good" },
          { key: "active_power", value: 275.2, unit: "W", quality: "good" },
          { key: "solar_power", value: 812.3, unit: "W", quality: "good" },
        ],
      }),
    });
    const body = (await res.json()) as { accepted?: boolean; measurementCount?: number };
    if (res.status === 201 && body.accepted) pass("POST /api/v1/telemetry/universal", `count=${body.measurementCount}`);
    else fail("POST /api/v1/telemetry/universal", `${res.status} ${JSON.stringify(body)}`);
  }

  // 6) Latest + devices + smart-grid + protocols
  if (siteId && cookie) {
    const latest = await jsonFetch(`/api/v1/measurements/latest?siteId=${siteId}`, { cookie });
    const lb = latest.body as { devices?: { reading?: { activePowerW?: number } }[] };
    if (latest.res.ok && (lb.devices?.length ?? 0) > 0) {
      pass("GET /api/v1/measurements/latest", `power=${lb.devices?.[0]?.reading?.activePowerW}`);
    } else fail("GET /api/v1/measurements/latest", JSON.stringify(latest.body));

    const grid = await jsonFetch(`/api/v1/smart-grid?siteId=${siteId}`, { cookie });
    if (grid.res.ok) pass("GET /api/v1/smart-grid", "ok");
    else fail("GET /api/v1/smart-grid", JSON.stringify(grid.body));

    const protocols = await jsonFetch("/api/v1/protocols", { cookie });
    const pb = protocols.body as { protocols?: { id: string; status: string }[] };
    const wsProto = pb.protocols?.find((p) => p.id === "websocket");
    if (protocols.res.ok && wsProto?.status === "implemented") {
      pass("GET /api/v1/protocols", `websocket=${wsProto.status}`);
    } else fail("GET /api/v1/protocols", `websocket=${wsProto?.status ?? "missing"}`);

    const ptest = await jsonFetch("/api/v1/protocols/test", {
      method: "POST",
      cookie,
      body: JSON.stringify({ protocol: "websocket", config: {} }),
    });
    const pt = ptest.body as { connectivity?: { ok?: boolean; message?: string } };
    if (ptest.res.ok && pt.connectivity?.ok) pass("POST /api/v1/protocols/test (websocket)", pt.connectivity.message ?? "ok");
    else fail("POST /api/v1/protocols/test (websocket)", JSON.stringify(ptest.body));
  }

  // 7) Device WebSocket ingest
  {
    const ws = new WebSocket(`${WS}/device?token=${encodeURIComponent(TOKEN)}`);
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("device WS connect timeout")), 8000);
      ws.once("open", () => {
        clearTimeout(t);
        resolve();
      });
      ws.once("error", reject);
    });

    const welcome = await waitMessage(ws, (m) => m.type === "welcome");
    pass("WS device welcome", `role=${welcome.role} publicId=${welcome.publicId}`);

    const ackPromise = waitMessage(ws, (m) => m.type === "ack" && m.kind === "telemetry");
    ws.send(
      JSON.stringify({
        type: "telemetry",
        deviceId: TOKEN.split(".")[0],
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        schemaVersion: 1,
        firmwareVersion: "ws-test-1.0",
        simulated: true,
        measurements: {
          voltageV: 229.1,
          currentA: 1.11,
          activePowerW: 242.0,
          powerFactor: 0.96,
          frequencyHz: 50.0,
          energyWh: 19110,
          quality: "GOOD",
        },
      }),
    );
    const ack = await ackPromise;
    const ackJson = ack.json as { accepted?: boolean } | undefined;
    if (ack.ok === true && ackJson?.accepted) pass("WS device telemetry ack", `status=${ack.status}`);
    else fail("WS device telemetry ack", JSON.stringify(ack));

    ws.close();
  }

  // 8) Live dashboard WebSocket (ticket + fanout)
  if (siteId && cookie) {
    const ticketRes = await jsonFetch("/api/v1/realtime/ticket", {
      method: "POST",
      cookie,
      body: JSON.stringify({ siteId }),
    });
    const tb = ticketRes.body as { ticket?: string; wsUrl?: string };
    if (!ticketRes.res.ok || !tb.ticket) {
      fail("POST /api/v1/realtime/ticket", JSON.stringify(ticketRes.body));
    } else {
      pass("POST /api/v1/realtime/ticket", `expires ticket issued`);

      const live = new WebSocket(
        `${tb.wsUrl ?? `${WS}/live`}?ticket=${encodeURIComponent(tb.ticket)}&siteId=${encodeURIComponent(siteId)}`,
      );
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("live WS connect timeout")), 8000);
        live.once("open", () => {
          clearTimeout(t);
          resolve();
        });
        live.once("error", reject);
      });

      const liveWelcome = await waitMessage(live, (m) => m.type === "welcome");
      pass("WS live welcome", `siteId=${liveWelcome.siteId}`);

      const fanoutPromise = waitMessage(
        live,
        (m) => m.type === "telemetry" || m.type === "universal" || m.type === "device_status",
        12000,
      );

      // Trigger HTTP ingest so Next publishes to realtime hub (fanout to live clients)
      await fetch(`${APP}/api/v1/telemetry`, {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: TOKEN.split(".")[0],
          eventId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          schemaVersion: 1,
          firmwareVersion: "fanout-test",
          simulated: true,
          measurements: {
            voltageV: 230,
            currentA: 1,
            activePowerW: 220,
            powerFactor: 0.95,
            frequencyHz: 50,
            energyWh: 19200,
            quality: "GOOD",
          },
        }),
      });

      try {
        const evt = await fanoutPromise;
        pass("WS live fanout", `type=${evt.type} publicId=${evt.publicId ?? "?"}`);
      } catch (e) {
        fail("WS live fanout", e instanceof Error ? e.message : String(e));
      }
      live.close();
    }
  }

  console.log("\n—— Summary ——");
  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    for (const f of failed) console.error(` - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("API + WebSocket working.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
