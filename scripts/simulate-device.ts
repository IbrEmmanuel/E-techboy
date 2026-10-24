/**
 * Development helper: POST telemetry via HTTP API and/or live WebSocket.
 *
 *   npx tsx scripts/simulate-device.ts --token esp32_demo000001.demo-device-secret-do-not-use-in-prod
 *   npx tsx scripts/simulate-device.ts --token ... --loop --interval 5000 --grid
 *   npx tsx scripts/simulate-device.ts --token ... --ws --loop   # live hardware WebSocket path
 */

import WebSocket from "ws";

const args = new Map<string, string>();
const flags = new Set<string>();
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i] ?? "";
  if (arg === "--loop" || arg === "--grid" || arg === "--ws") {
    flags.add(arg.replace(/^--/, ""));
    continue;
  }
  if (arg.startsWith("--")) {
    args.set(arg.replace(/^--/, ""), process.argv[i + 1] ?? "");
    i += 1;
  }
}

const url = (args.get("url") ?? process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const wsBase = (args.get("wsUrl") ?? process.env.REALTIME_WS_URL ?? "ws://127.0.0.1:3001").replace(/\/$/, "");
const token =
  args.get("token") ?? process.env.DEVICE_TOKEN ?? "esp32_demo000001.demo-device-secret-do-not-use-in-prod";
const intervalMs = Number(args.get("interval") ?? "5000");
const loop = flags.has("loop");
const withGrid = flags.has("grid");
const useWs = flags.has("ws");

const publicId = token.split(".")[0] ?? "unknown";
let energyWh = 18_450 + Math.random() * 200;

function sampleElectrical() {
  const voltageV = 220 + (Math.random() * 12 - 4);
  const currentA = 0.8 + Math.random() * 1.8;
  const powerFactor = 0.92 + Math.random() * 0.06;
  const activePowerW = voltageV * currentA * powerFactor;
  energyWh += activePowerW * (intervalMs / 3_600_000);
  return {
    voltageV: Number(voltageV.toFixed(2)),
    currentA: Number(currentA.toFixed(3)),
    activePowerW: Number(activePowerW.toFixed(1)),
    powerFactor: Number(powerFactor.toFixed(3)),
    frequencyHz: Number((49.9 + Math.random() * 0.2).toFixed(2)),
    energyWh: Number(energyWh.toFixed(1)),
    quality: "GOOD" as const,
  };
}

function legacyPayload(measurements: ReturnType<typeof sampleElectrical>) {
  return {
    type: "telemetry",
    deviceId: publicId,
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    schemaVersion: 1,
    firmwareVersion: "sim-ws-1.0.0",
    simulated: true,
    units: {
      voltage: "V",
      current: "A",
      activePower: "W",
      energy: "Wh",
      frequency: "Hz",
      powerFactor: "1",
    },
    measurements,
  };
}

async function postLegacyHttp() {
  const measurements = sampleElectrical();
  const payload = legacyPayload(measurements);
  delete (payload as { type?: string }).type;

  const response = await fetch(`${url}/api/v1/telemetry`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  console.log(`[http/legacy] ${response.status}`, text.slice(0, 200));
  if (!response.ok) throw new Error(`legacy ingest failed: ${response.status} ${text}`);
  return measurements;
}

async function postUniversalGridExtras(base: ReturnType<typeof sampleElectrical>) {
  const solar = 400 + Math.random() * 900;
  const batterySoc = 55 + Math.random() * 30;
  const payload = {
    device_id: publicId,
    recorded_at: new Date().toISOString(),
    protocol: "http",
    schema_version: 1,
    metadata: { simulated: true, firmware: "sim-1.0.0", source: "grid-extras" },
    measurements: [
      { key: "voltage", value: base.voltageV, unit: "V", quality: "good" },
      { key: "current", value: base.currentA, unit: "A", quality: "good" },
      { key: "active_power", value: base.activePowerW, unit: "W", quality: "good" },
      { key: "power_factor", value: base.powerFactor, unit: "1", quality: "good" },
      { key: "frequency", value: base.frequencyHz, unit: "Hz", quality: "good" },
      { key: "energy", value: base.energyWh, unit: "Wh", quality: "good" },
      { key: "solar_power", value: Number(solar.toFixed(1)), unit: "W", quality: "good" },
      { key: "battery_soc", value: Number(batterySoc.toFixed(1)), unit: "%", quality: "good" },
      { key: "battery_power", value: Number((Math.random() * 200 - 80).toFixed(1)), unit: "W", quality: "good" },
      {
        key: "export_energy_kwh",
        value: Number(((base.energyWh / 1000) * 0.08).toFixed(3)),
        unit: "kWh",
        quality: "good",
      },
    ],
  };

  const response = await fetch(`${url}/api/v1/telemetry/universal`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  console.log(`[http/universal] ${response.status}`, text.slice(0, 200));
  if (!response.ok) throw new Error(`universal ingest failed: ${response.status} ${text}`);
}

function openDeviceSocket(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsBase}/device?token=${encodeURIComponent(token)}`);
    const timer = setTimeout(() => reject(new Error("WebSocket connect timeout")), 8000);
    ws.once("open", () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function runWsLoop() {
  console.log(`WebSocket hardware sim → ${wsBase}/device as ${publicId}`);
  const ws = await openDeviceSocket();
  let welcomed = false;
  ws.on("message", (raw) => {
    const text = String(raw);
    console.log(`[ws]`, text.slice(0, 240));
    try {
      const msg = JSON.parse(text) as { type?: string };
      if (msg.type === "welcome") welcomed = true;
    } catch {
      // ignore
    }
  });

  for (let i = 0; i < 40 && !welcomed; i++) {
    await new Promise((r) => setTimeout(r, 50));
  }

  const sendTick = () => {
    if (ws.readyState !== WebSocket.OPEN) return;
    const measurements = sampleElectrical();
    ws.send(JSON.stringify(legacyPayload(measurements)));
    if (withGrid) {
      ws.send(
        JSON.stringify({
          type: "universal",
          device_id: publicId,
          recorded_at: new Date().toISOString(),
          protocol: "websocket",
          schema_version: 1,
          metadata: { simulated: true, firmware: "sim-ws-1.0.0" },
          measurements: [
            { key: "voltage", value: measurements.voltageV, unit: "V", quality: "good" },
            { key: "current", value: measurements.currentA, unit: "A", quality: "good" },
            { key: "active_power", value: measurements.activePowerW, unit: "W", quality: "good" },
            { key: "solar_power", value: Number((500 + Math.random() * 400).toFixed(1)), unit: "W", quality: "good" },
            { key: "battery_soc", value: Number((60 + Math.random() * 20).toFixed(1)), unit: "%", quality: "good" },
          ],
        }),
      );
    }
  };

  sendTick();
  if (!loop) {
    await new Promise((r) => setTimeout(r, 2500));
    ws.close();
    return;
  }

  const timer = setInterval(sendTick, intervalMs);
  ws.on("close", () => {
    clearInterval(timer);
    console.error("[ws] disconnected — restart with --ws --loop");
    process.exit(1);
  });
  await new Promise(() => undefined);
}

async function tickHttp() {
  const measurements = await postLegacyHttp();
  if (withGrid) await postUniversalGridExtras(measurements);
}

async function main() {
  if (useWs) {
    await runWsLoop();
    console.log("Done (WebSocket).");
    return;
  }

  if (loop) {
    console.log(`Simulating ${publicId} every ${intervalMs}ms against ${url}${withGrid ? " (+grid extras)" : ""}`);
    for (;;) {
      try {
        await tickHttp();
      } catch (error) {
        console.error(error);
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  await tickHttp();
  console.log("Done. Use --ws --loop for live WebSocket hardware path.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
