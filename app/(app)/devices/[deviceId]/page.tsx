"use client";

import { use, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { GlassCard } from "@/components/glass-card";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/empty-state";
import { PageStack, SplitLayout } from "@/components/layout/page";
import { apiFetch } from "@/lib/client/api";

type DeviceDetail = {
  device: {
    id: string;
    publicId: string;
    name: string;
    status: string;
    connectionState: string;
    category: string;
    protocol: string;
    manufacturer: string | null;
    model: string | null;
    firmwareVersion: string | null;
    lastSeenAt: string | null;
    lastSuccessfulAt: string | null;
    lastError: string | null;
    demoMode: boolean;
    writeEnabled: boolean;
    sensorModel: string;
  };
  latestMeasurements: {
    key: string;
    valueNumber: number | null;
    valueBool: boolean | null;
    valueText: string | null;
    unit: string | null;
    quality: string;
    recordedAt: string;
    simulated: boolean;
  }[];
  latestReading: {
    voltageV: number;
    currentA: number;
    activePowerW: number;
    powerFactor: number;
    frequencyHz: number;
    energyWh: number;
    recordedAt: string;
    simulated: boolean;
  } | null;
  commands: { id: string; type: string; status: string; createdAt: string; expiresAt: string }[];
  connectionLogs: { state: string; message: string | null; createdAt: string }[];
  protocolConfig: { capabilityStatus: string; lastTestOk: boolean | null; lastTestMessage: string | null } | null;
};

export default function DeviceDetailPage({ params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = use(params);
  const { data, error, mutate } = useSWR<DeviceDetail>(`/api/v1/devices/${deviceId}`, (url: string) => apiFetch(url), {
    refreshInterval: 8000,
  });
  const [cmdMsg, setCmdMsg] = useState<string | null>(null);
  const [cmdBusy, setCmdBusy] = useState(false);

  if (error) return <ErrorState message={error.message} onRetry={() => mutate()} />;
  if (!data) {
    return (
      <GlassCard>
        <p className="text-sm text-muted">Loading device…</p>
      </GlassCard>
    );
  }

  const d = data.device;
  const measurements =
    data.latestMeasurements.length > 0
      ? data.latestMeasurements
      : data.latestReading
        ? [
            { key: "voltage", valueNumber: data.latestReading.voltageV, valueBool: null, valueText: null, unit: "V", quality: "GOOD", recordedAt: data.latestReading.recordedAt, simulated: data.latestReading.simulated },
            { key: "current", valueNumber: data.latestReading.currentA, valueBool: null, valueText: null, unit: "A", quality: "GOOD", recordedAt: data.latestReading.recordedAt, simulated: data.latestReading.simulated },
            { key: "active_power", valueNumber: data.latestReading.activePowerW, valueBool: null, valueText: null, unit: "W", quality: "GOOD", recordedAt: data.latestReading.recordedAt, simulated: data.latestReading.simulated },
            { key: "energy", valueNumber: data.latestReading.energyWh, valueBool: null, valueText: null, unit: "Wh", quality: "GOOD", recordedAt: data.latestReading.recordedAt, simulated: data.latestReading.simulated },
          ]
        : [];

  return (
    <PageStack>
      <SplitLayout
        main={
          <GlassCard>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs text-muted">
                  <Link href="/devices" className="underline-offset-2 hover:underline">
                    Devices
                  </Link>{" "}
                  / <span className="break-all">{d.publicId}</span>
                </p>
                <h1 className="text-lg font-semibold sm:text-xl">{d.name}</h1>
                <p className="text-xs text-muted sm:text-sm">
                  {d.manufacturer ?? "—"} {d.model ?? d.sensorModel} · {d.category} · {d.protocol}
                  {d.demoMode ? " · DEMO" : ""}
                </p>
              </div>
              <div className="shrink-0 text-left text-sm sm:text-right">
                <p>
                  {d.status} / {d.connectionState}
                </p>
                <p className="text-xs text-muted">FW {d.firmwareVersion ?? "unknown"}</p>
              </div>
            </div>

            <h2 className="mt-5 font-semibold sm:mt-6">Latest measurements</h2>
            {measurements.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                No measurements yet. Ingest via HTTP firmware, universal API, or `npm run simulate`.
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
                {measurements.map((m) => (
                  <div key={m.key} className="min-w-0 rounded-xl bg-white/40 p-3 dark:bg-white/5 sm:rounded-2xl">
                    <p className="truncate text-xs uppercase tracking-wide text-muted">{m.key}</p>
                    <p className="text-base font-semibold sm:text-lg">
                      {m.valueNumber ?? (m.valueBool === null ? m.valueText : String(m.valueBool))}
                      {m.unit ? <span className="ml-1 text-sm font-normal text-muted">{m.unit}</span> : null}
                    </p>
                    <p className="text-[11px] text-muted">
                      {m.quality} · {new Date(m.recordedAt).toLocaleString()}
                      {m.simulated ? " · sim" : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <h2 className="mt-6 font-semibold">Authorized commands</h2>
            <p className="mt-1 text-xs text-muted">
              Stored allowlisted records only (REQUEST_STATUS / ROTATE_CREDENTIAL). No GPIO remote control.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={cmdBusy}
                onClick={async () => {
                  setCmdBusy(true);
                  setCmdMsg(null);
                  try {
                    const result = await apiFetch<{ command: { id: string; type: string }; note?: string }>(
                      `/api/v1/commands?deviceId=${deviceId}`,
                      { method: "POST", body: JSON.stringify({ type: "REQUEST_STATUS", expiresInSeconds: 900 }) },
                    );
                    setCmdMsg(`Queued ${result.command.type} (${result.command.id.slice(0, 8)}…) · ${result.note ?? "record-only"}`);
                    await mutate();
                  } catch (e) {
                    setCmdMsg(e instanceof Error ? e.message : "Command failed");
                  } finally {
                    setCmdBusy(false);
                  }
                }}
              >
                Request status
              </Button>
            </div>
            {cmdMsg ? <p className="mt-2 text-xs text-muted">{cmdMsg}</p> : null}
            <div className="mt-3 space-y-2 text-xs">
              {(data.commands ?? []).slice(0, 8).map((c) => (
                <div key={c.id} className="rounded-xl bg-white/40 px-2.5 py-1.5 dark:bg-white/5">
                  {c.type} · {c.status} · {new Date(c.createdAt).toLocaleString()}
                </div>
              ))}
              {(data.commands ?? []).length === 0 ? <p className="text-muted">No commands yet.</p> : null}
            </div>
          </GlassCard>
        }
        side={
          <div className="grid gap-3 sm:gap-4">
            <GlassCard>
              <h2 className="font-semibold">Diagnostics</h2>
              <ul className="mt-3 space-y-2 break-words text-sm">
                <li>Last seen: {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : "—"}</li>
                <li>Last success: {d.lastSuccessfulAt ? new Date(d.lastSuccessfulAt).toLocaleString() : "—"}</li>
                <li>Last error: {d.lastError ?? "—"}</li>
                <li>Write enabled: {d.writeEnabled ? "yes" : "no (read-only)"}</li>
                <li>
                  Protocol: {data.protocolConfig?.capabilityStatus ?? "n/a"}
                  {data.protocolConfig?.lastTestMessage ? ` — ${data.protocolConfig.lastTestMessage}` : ""}
                </li>
              </ul>
            </GlassCard>
            <GlassCard>
              <h2 className="font-semibold">Connection log</h2>
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto text-xs">
                {data.connectionLogs.length === 0 ? (
                  <p className="text-muted">No connection events yet.</p>
                ) : (
                  data.connectionLogs.map((log, i) => (
                    <div key={`${log.createdAt}-${i}`} className="rounded-xl bg-white/40 px-2 py-1.5 dark:bg-white/5">
                      <p className="font-medium">{log.state}</p>
                      <p className="text-muted">{log.message}</p>
                      <p className="text-muted">{new Date(log.createdAt).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </div>
        }
      />
    </PageStack>
  );
}
