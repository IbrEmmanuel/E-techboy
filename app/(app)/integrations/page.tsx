"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { PageHeader, PageStack, SplitLayout } from "@/components/layout/page";
import { useDeviceProfiles, useGateways, useMe, useProtocols } from "@/lib/client/hooks";
import { apiFetch } from "@/lib/client/api";

const STEPS = [
  "Category",
  "Model",
  "Protocol",
  "Connection",
  "Auth",
  "Mapping",
  "Test",
  "Save",
];

export default function IntegrationsPage() {
  const search = useSearchParams();
  const { data: me } = useMe();
  const siteId = search.get("siteId") ?? me?.user.sites[0]?.id ?? null;
  const profiles = useDeviceProfiles();
  const protocols = useProtocols();
  const gateways = useGateways(siteId);

  const [step, setStep] = useState(0);
  const [category, setCategory] = useState("ESP32");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [manufacturer, setManufacturer] = useState("Espressif");
  const [model, setModel] = useState("ESP32 + PZEM-004T");
  const [protocol, setProtocol] = useState("HTTP");
  const [name, setName] = useState("New device");
  const [gatewayId, setGatewayId] = useState("");
  const [demoMode, setDemoMode] = useState(true);
  const [brokerUrl, setBrokerUrl] = useState("mqtts://broker.example.com");
  const [topicNamespace, setTopicNamespace] = useState("org/site/devices");
  const [modbusHost, setModbusHost] = useState("192.168.1.50");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredProfiles = useMemo(
    () => (profiles.data?.profiles ?? []).filter((p) => p.category === category),
    [profiles.data, category],
  );

  const selectedProtocol = protocols.data?.protocols.find((p) => p.id === protocol.toLowerCase());

  function buildConfig() {
    if (protocol === "MQTT") {
      return {
        brokerUrl,
        topicNamespace,
        telemetryTopic: `${topicNamespace}/+/telemetry`,
        qos: 1 as const,
        tls: true,
      };
    }
    if (protocol === "MODBUS_TCP") {
      return {
        host: modbusHost,
        port: 502,
        unitId: 1,
        pollIntervalMs: 5000,
        registers: [
          { key: "voltage", address: 0, type: "uint16" as const, scale: 0.1, unit: "V" },
          { key: "current", address: 1, type: "uint16" as const, scale: 0.01, unit: "A" },
        ],
        writeEnabled: false,
      };
    }
    if (protocol === "CUSTOM") {
      return { name: "Custom", ingestPath: "/api/v1/telemetry/universal" as const };
    }
    return { mode: "ingest" as const, timeoutMs: 5000, retryMax: 2 };
  }

  async function runTest() {
    setError(null);
    setTestResult(null);
    try {
      const result = await apiFetch<{
        connectivity: { ok: boolean; message: string };
        validation: { warnings: string[] };
        note: string;
      }>("/api/v1/protocols/test", {
        method: "POST",
        body: JSON.stringify({ protocol: protocol.toLowerCase(), config: buildConfig() }),
      });
      setTestResult(
        `${result.connectivity.ok ? "Config OK" : "Config failed"} — ${result.connectivity.message}\n${result.note}${
          result.validation.warnings.length ? `\nWarnings: ${result.validation.warnings.join(" | ")}` : ""
        }`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test failed");
    }
  }

  async function saveDevice() {
    if (!siteId) return;
    setError(null);
    try {
      const result = await apiFetch<{
        device: { id: string; publicId: string };
        credential: { token: string };
        nextStep: string;
      }>(`/api/v1/devices?siteId=${siteId}`, {
        method: "POST",
        body: JSON.stringify({
          name,
          category,
          protocol,
          manufacturer,
          model,
          profileId: profileId?.startsWith("catalog-") ? undefined : profileId ?? undefined,
          gatewayId: gatewayId || undefined,
          demoMode,
          sensorModel: model,
          connectionConfig: buildConfig(),
          measurementDefs: [
            { key: "voltage", label: "Voltage", unit: "V" },
            { key: "current", label: "Current", unit: "A" },
            { key: "active_power", label: "Active power", unit: "W" },
          ],
        }),
      });
      setSecret(result.credential.token);
      setCreatedId(result.device.id);
      setTestResult(result.nextStep);
      setStep(7);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  if (profiles.error || protocols.error) {
    return (
      <ErrorState
        message="Failed to load integration catalog"
        onRetry={() => {
          profiles.mutate();
          protocols.mutate();
        }}
      />
    );
  }

  const wizard = (
    <GlassCard>
      <PageHeader
        title="Connection center"
        description="Guided setup with real validation. Live links need hardware or a gateway."
        actions={
          <p className="text-xs text-muted">
            Step {step + 1}/{STEPS.length}: {STEPS[step]}
          </p>
        }
      />

      <div className="-mx-1 mt-3 flex gap-1 overflow-x-auto px-1 pb-1 sm:mt-4 sm:flex-wrap sm:overflow-visible">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(index)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] sm:px-3 sm:text-xs ${
              index === step ? "bg-teal-700 text-white" : "bg-white/50 dark:bg-white/10"
            }`}
          >
            {index + 1}. {label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {step === 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {(profiles.data?.categories ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCategory(c.id);
                  setStep(1);
                }}
                className={`rounded-2xl p-3 text-left ${
                  category === c.id ? "bg-teal-700/15 ring-1 ring-teal-700" : "bg-white/40 dark:bg-white/5"
                }`}
              >
                <p className="font-medium">{c.label}</p>
                <p className="text-xs text-muted">{c.guidance}</p>
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-2">
            {filteredProfiles.length === 0 ? (
              <EmptyState title="No profiles" body="Choose Custom Device and continue." />
            ) : (
              filteredProfiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setProfileId(p.id);
                    setManufacturer(p.manufacturer);
                    setModel(p.model);
                    setProtocol(p.protocol);
                    setStep(2);
                  }}
                  className="block w-full rounded-2xl bg-white/40 p-3 text-left dark:bg-white/5"
                >
                  <p className="font-medium">
                    {p.manufacturer} · {p.model}
                  </p>
                  <p className="text-xs text-muted">{p.description}</p>
                </button>
              ))
            )}
            <Button
              variant="outline"
              onClick={() => {
                setManufacturer("Custom");
                setModel("Custom Device");
                setProtocol("CUSTOM");
                setStep(2);
              }}
            >
              Custom Device
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {(protocols.data?.protocols ?? []).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProtocol(p.id.toUpperCase());
                  setStep(3);
                }}
                className="rounded-2xl bg-white/40 p-3 text-left dark:bg-white/5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{p.name}</p>
                  <span className="rounded-full bg-stone-900/80 px-2 py-0.5 text-[10px] uppercase text-white">
                    {p.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">{p.description}</p>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Device name"
              placeholder="Device name"
            />
            {selectedProtocol?.capabilities.requiresGateway ? (
              <div>
                <p className="mb-2 text-sm text-muted">This protocol needs a gateway or local agent.</p>
                <select
                  className="w-full rounded-2xl border bg-transparent px-3 py-2 text-sm"
                  value={gatewayId}
                  onChange={(e) => setGatewayId(e.target.value)}
                >
                  <option value="">Select gateway…</option>
                  {(gateways.data?.gateways ?? []).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.status})
                    </option>
                  ))}
                </select>
                <Link href="/gateways" className="mt-2 inline-block text-sm text-teal-700 dark:text-teal-300">
                  Manage gateways →
                </Link>
              </div>
            ) : null}
            {protocol === "MQTT" ? (
              <>
                <Input value={brokerUrl} onChange={(e) => setBrokerUrl(e.target.value)} aria-label="Broker URL" />
                <Input
                  value={topicNamespace}
                  onChange={(e) => setTopicNamespace(e.target.value)}
                  aria-label="Topic namespace"
                />
              </>
            ) : null}
            {protocol === "MODBUS_TCP" ? (
              <Input value={modbusHost} onChange={(e) => setModbusHost(e.target.value)} aria-label="Modbus host" />
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={demoMode} onChange={(e) => setDemoMode(e.target.checked)} />
              Demo mode (simulated / no live hardware claim)
            </label>
            <Button onClick={() => setStep(4)}>Continue</Button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              A device credential will be issued on save (shown once). Connection passwords are encrypted at rest when
              CREDENTIALS_ENCRYPTION_KEY is configured. Never paste production PLC passwords into demos.
            </p>
            <Button onClick={() => setStep(5)}>Continue to mapping</Button>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            <p className="text-sm">
              Default measurement map: voltage (V), current (A), active_power (W). Adjust later on the device dashboard.
            </p>
            <Button onClick={() => setStep(6)}>Continue to test</Button>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Test validates configuration only unless a gateway reports a live session. We will not pretend a device was
              discovered.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={runTest}>Test connectivity</Button>
              <Button variant="outline" onClick={() => setStep(7)}>
                Skip to save
              </Button>
            </div>
            {testResult ? (
              <pre className="whitespace-pre-wrap rounded-2xl bg-white/50 p-3 text-xs dark:bg-white/5">{testResult}</pre>
            ) : null}
            <Button onClick={saveDevice} disabled={!siteId}>
              Save device
            </Button>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-3">
            {secret ? (
              <>
                <p className="text-sm font-medium">Device registered</p>
                <p className="break-all rounded-2xl bg-amber-50 p-3 text-xs dark:bg-amber-400/10">
                  Token (copy now): {secret}
                </p>
                {createdId ? (
                  <Link href={`/devices/${createdId}`} className="text-sm text-teal-700 dark:text-teal-300">
                    Open device dashboard →
                  </Link>
                ) : null}
              </>
            ) : (
              <Button onClick={saveDevice} disabled={!siteId}>
                Save device
              </Button>
            )}
            {testResult ? <p className="text-xs text-muted">{testResult}</p> : null}
          </div>
        )}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </GlassCard>
  );

  const side = (
    <div className="grid gap-3 sm:gap-4">
      <GlassCard>
        <h2 className="font-semibold">Protocol catalog</h2>
        <p className="mt-1 text-xs text-muted">{protocols.data?.note}</p>
        <ul className="mt-3 space-y-2 text-sm">
          {(protocols.data?.protocols ?? []).slice(0, 8).map((p) => (
            <li key={p.id} className="flex justify-between gap-2">
              <span>{p.name}</span>
              <span className="shrink-0 text-xs text-muted">{p.status}</span>
            </li>
          ))}
        </ul>
      </GlassCard>
      <GlassCard>
        <h2 className="font-semibold">Compatibility</h2>
        <p className="mt-2 text-sm text-muted">{profiles.data?.compatibilityNote}</p>
      </GlassCard>
    </div>
  );

  return (
    <PageStack>
      <SplitLayout main={wizard} side={side} />
    </PageStack>
  );
}
