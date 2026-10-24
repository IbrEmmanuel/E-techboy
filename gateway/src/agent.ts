/**
 * EnergyMonitor gateway agent (Raspberry Pi / Linux edge).
 * - Outbound HTTPS heartbeats + command pull
 * - Optional local device poll → cloud universal ingest (sim or mapped readings)
 * - Store-and-forward buffer for temporary outages
 * - Does NOT execute arbitrary cloud shell/code
 *
 * Env:
 *   ENERGYMONITOR_URL, GATEWAY_TOKEN (required)
 *   LOCAL_DEVICE_TOKEN — when set, agent posts simulated Modbus-style readings for that device
 *   POLL_INTERVAL_MS — default 10000
 */

import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const envSchema = z.object({
  ENERGYMONITOR_URL: z.string().url(),
  GATEWAY_TOKEN: z.string().min(16),
  AGENT_VERSION: z.string().default("0.2.0"),
  HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(5000).default(30000),
  BUFFER_DIR: z.string().default("./data/buffer"),
  LOCAL_DEVICE_TOKEN: z.string().optional(),
  POLL_INTERVAL_MS: z.coerce.number().int().min(2000).default(10000),
});

type BufferedReading = {
  deviceToken: string;
  payload: unknown;
  queuedAt: string;
};

const config = envSchema.parse(process.env);
const bufferFile = path.join(config.BUFFER_DIR, "telemetry.jsonl");
let energyWh = 20_000;
let lastPollAt = 0;

async function ensureBuffer() {
  await mkdir(config.BUFFER_DIR, { recursive: true });
  if (!existsSync(bufferFile)) await writeFile(bufferFile, "");
}

async function heartbeat() {
  const res = await fetch(`${config.ENERGYMONITOR_URL.replace(/\/$/, "")}/api/v1/gateways/heartbeat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.GATEWAY_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agentVersion: config.AGENT_VERSION,
      uptimeSec: Math.floor(process.uptime()),
      metadata: {
        hostname: process.env.HOSTNAME ?? "gateway",
        pid: process.pid,
        localPoll: Boolean(config.LOCAL_DEVICE_TOKEN),
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Heartbeat failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    commands?: { commandId: string; type: string; devicePublicId: string; payload: unknown; expiresAt: string }[];
  };
  for (const cmd of data.commands ?? []) {
    await handleCommand(cmd);
  }
}

async function handleCommand(cmd: {
  commandId: string;
  type: string;
  devicePublicId: string;
  payload: unknown;
  expiresAt: string;
}) {
  const allowlist = new Set(["REQUEST_STATUS", "ROTATE_CREDENTIAL"]);
  if (!allowlist.has(cmd.type)) {
    console.warn(`[gateway] Rejected non-allowlisted command ${cmd.type} (${cmd.commandId})`);
    return;
  }
  if (new Date(cmd.expiresAt).getTime() < Date.now()) {
    console.warn(`[gateway] Expired command ${cmd.commandId}`);
    return;
  }
  console.info(`[gateway] Queued allowed command ${cmd.type} for ${cmd.devicePublicId} id=${cmd.commandId}`);

  // Acknowledge via device token when polling the same device
  if (config.LOCAL_DEVICE_TOKEN?.startsWith(`${cmd.devicePublicId}.`)) {
    try {
      await fetch(`${config.ENERGYMONITOR_URL.replace(/\/$/, "")}/api/v1/commands`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${config.LOCAL_DEVICE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ commandId: cmd.commandId }),
      });
      console.info(`[gateway] ACK ${cmd.commandId}`);
    } catch (error) {
      console.warn("[gateway] ACK failed", error instanceof Error ? error.message : error);
    }
  }
}

export async function enqueueTelemetry(deviceToken: string, payload: unknown) {
  await ensureBuffer();
  const row: BufferedReading = { deviceToken, payload, queuedAt: new Date().toISOString() };
  await appendFile(bufferFile, `${JSON.stringify(row)}\n`);
}

async function flushBuffer() {
  await ensureBuffer();
  const raw = await readFile(bufferFile, "utf8");
  if (!raw.trim()) return;
  const lines = raw.split("\n").filter(Boolean);
  const remaining: string[] = [];
  for (const line of lines) {
    try {
      const row = JSON.parse(line) as BufferedReading;
      const res = await fetch(`${config.ENERGYMONITOR_URL.replace(/\/$/, "")}/api/v1/telemetry/universal`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${row.deviceToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(row.payload),
      });
      if (!res.ok) remaining.push(line);
    } catch {
      remaining.push(line);
    }
  }
  await writeFile(bufferFile, remaining.length ? `${remaining.join("\n")}\n` : "");
}

/** Local Modbus-style poll simulator → universal ingest (or buffer on failure). */
async function pollLocalDevice() {
  if (!config.LOCAL_DEVICE_TOKEN) return;
  const now = Date.now();
  if (now - lastPollAt < config.POLL_INTERVAL_MS) return;
  lastPollAt = now;

  const publicId = config.LOCAL_DEVICE_TOKEN.split(".")[0] ?? "device";
  const voltage = 228 + Math.random() * 6;
  const current = 1 + Math.random() * 1.5;
  const pf = 0.94 + Math.random() * 0.04;
  const power = voltage * current * pf;
  energyWh += power * (config.POLL_INTERVAL_MS / 3_600_000);

  const payload = {
    device_id: publicId,
    recorded_at: new Date().toISOString(),
    protocol: "modbus_tcp",
    schema_version: 1,
    metadata: {
      simulated: true,
      firmware: config.AGENT_VERSION,
      source: "gateway-local-poll",
      map: "holding-registers-demo",
    },
    measurements: [
      { key: "voltage", value: Number(voltage.toFixed(2)), unit: "V", quality: "good" },
      { key: "current", value: Number(current.toFixed(3)), unit: "A", quality: "good" },
      { key: "active_power", value: Number(power.toFixed(1)), unit: "W", quality: "good" },
      { key: "power_factor", value: Number(pf.toFixed(3)), unit: "1", quality: "good" },
      { key: "frequency", value: 50.0, unit: "Hz", quality: "good" },
      { key: "energy", value: Number(energyWh.toFixed(1)), unit: "Wh", quality: "good" },
    ],
  };

  const res = await fetch(`${config.ENERGYMONITOR_URL.replace(/\/$/, "")}/api/v1/telemetry/universal`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.LOCAL_DEVICE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.warn(`[gateway] poll ingest ${res.status}, buffering`);
    await enqueueTelemetry(config.LOCAL_DEVICE_TOKEN, payload);
    return;
  }
  console.info(`[gateway] polled ${publicId} power=${power.toFixed(1)}W`);
}

async function loop() {
  await ensureBuffer();
  console.info(`[gateway] EnergyMonitor gateway agent ${config.AGENT_VERSION} starting`);
  console.info("[gateway] Safety: no arbitrary remote code execution; command allowlist enforced");
  if (config.LOCAL_DEVICE_TOKEN) {
    console.info("[gateway] LOCAL_DEVICE_TOKEN set — publishing Modbus-style simulated polls");
  }
  for (;;) {
    try {
      await heartbeat();
      await pollLocalDevice();
      await flushBuffer();
    } catch (error) {
      console.error("[gateway]", error instanceof Error ? error.message : error);
    }
    await new Promise((r) => setTimeout(r, Math.min(config.HEARTBEAT_INTERVAL_MS, config.POLL_INTERVAL_MS)));
  }
}

loop().catch((error) => {
  console.error(error);
  process.exit(1);
});
