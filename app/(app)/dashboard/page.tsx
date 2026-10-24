"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ComparisonChart, PowerChart } from "@/components/dashboard/charts";
import { GlassCard } from "@/components/glass-card";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { useAlerts, useAnalytics, useLatest, useMe } from "@/lib/client/hooks";
import { MetricGrid, PageStack } from "@/components/layout/page";
import { LIVE_UPDATE_NOTE } from "@/types";

export default function DashboardPage() {
  const search = useSearchParams();
  const { data: me } = useMe();
  const siteId = search.get("siteId") ?? me?.user.preferences?.defaultSiteId ?? me?.user.sites[0]?.id ?? null;
  const [defaultRange] = useState(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 24 * 3600 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
  });
  const from = search.get("from") ?? defaultRange.from;
  const to = search.get("to") ?? defaultRange.to;
  const live = useLatest(siteId);
  const analytics = useAnalytics(siteId, from, to);
  const alerts = useAlerts(siteId);
  const snapshot = live.data?.devices[0];
  const reading = snapshot?.reading;
  const loading = !live.data && !live.error;

  if (live.error) {
    return <ErrorState message={live.error.message} onRetry={() => live.mutate()} />;
  }

  return (
    <PageStack>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${
            live.realtimeStatus === "live"
              ? "bg-teal-700/15 text-teal-800 dark:text-teal-200"
              : "bg-white/40 dark:bg-white/10"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              live.realtimeStatus === "live" ? "bg-teal-600" : "bg-amber-500"
            }`}
          />
          WS {live.realtimeStatus ?? "idle"}
        </span>
        <p className="hidden min-w-0 flex-1 sm:block">{live.data?.note ?? LIVE_UPDATE_NOTE}</p>
      </div>
      <MetricGrid>
        <MetricCard label="Voltage" unit="V" value={fmt(reading?.voltageV, 1)} source="latest" loading={loading} simulated={reading?.simulated} hint="PZEM-004T voltage" />
        <MetricCard label="Current" unit="A" value={fmt(reading?.currentA, 3)} source="latest" loading={loading} simulated={reading?.simulated} />
        <MetricCard label="Power" unit="W" value={fmt(reading?.activePowerW, 1)} source="latest" loading={loading} simulated={reading?.simulated} />
        <MetricCard label="Energy" unit="kWh" value={fmt(reading ? reading.energyWh / 1000 : null, 3)} source="meter" loading={loading} simulated={reading?.simulated} />
        <MetricCard label="PF" unit="1" value={fmt(reading?.powerFactor, 3)} source="latest" loading={loading} simulated={reading?.simulated} />
        <MetricCard label="Freq" unit="Hz" value={fmt(reading?.frequencyHz, 2)} source="latest" loading={loading} simulated={reading?.simulated} />
      </MetricGrid>
      <div className="grid gap-3 sm:gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <PowerChart data={analytics.data?.analytics.series ?? []} loading={!analytics.data && !analytics.error} />
        </div>
        <GlassCard>
          <h2 className="font-semibold">Devices</h2>
          <p className="text-xs text-muted">Online within stale window</p>
          <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
            {(live.data?.devices ?? []).length === 0 ? (
              <EmptyState title="No devices" body="Register an ESP32 from Devices." />
            ) : (
              live.data?.devices.map((row) => (
                <div key={row.device.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/40 px-2.5 py-2 dark:bg-white/5 sm:rounded-2xl sm:px-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.device.name}</p>
                    <p className="truncate text-xs text-muted">{row.device.publicId}</p>
                  </div>
                  <span className={`shrink-0 text-xs ${row.stale ? "text-amber-700" : "text-teal-700"}`}>
                    {row.stale ? "Stale" : "Online"}
                  </span>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </div>
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        <ComparisonChart title="Daily kWh" unit="kWh" data={analytics.data?.analytics.daily ?? []} xKey="day" yKey="energyKwh" loading={!analytics.data && !analytics.error} />
        <ComparisonChart title="Monthly kWh" unit="kWh" data={analytics.data?.analytics.monthly ?? []} xKey="month" yKey="energyKwh" loading={!analytics.data && !analytics.error} />
      </div>
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        <GlassCard>
          <h2 className="font-semibold">Est. cost</h2>
          <p className="mt-2 text-2xl font-semibold sm:mt-3 sm:text-3xl">
            {analytics.data?.analytics.cost.amount.toFixed(2) ?? "—"}{" "}
            <span className="text-base text-muted">{analytics.data?.analytics.cost.currency ?? ""}</span>
          </p>
          <p className="mt-2 text-xs text-muted">
            From tariff dates · incomplete: {String(analytics.data?.analytics.cost.incomplete ?? true)}
          </p>
        </GlassCard>
        <GlassCard>
          <h2 className="font-semibold">Recent alerts</h2>
          <div className="mt-3 space-y-2">
            {(alerts.data?.alerts ?? []).slice(0, 6).length === 0 ? (
              <EmptyState title="No alerts" body="Threshold events appear after ingestion." />
            ) : (
              alerts.data?.alerts.slice(0, 6).map((alert) => (
                <div key={alert.id} className="rounded-xl bg-white/40 px-2.5 py-2 text-sm dark:bg-white/5 sm:rounded-2xl sm:px-3">
                  <p className="font-medium">{alert.title}</p>
                  <p className="text-xs text-muted">{alert.message}</p>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </div>
      <GlassCard>
        <h2 className="font-semibold">Peak & method</h2>
        <p className="mt-2 text-sm">
          Peak {fmt(analytics.data?.analytics.totals.peakPowerW ?? null, 1)} W · Avg{" "}
          {fmt(analytics.data?.analytics.totals.avgPowerW ?? null, 1)} W · {analytics.data?.analytics.totals.method ?? "—"}
        </p>
        <ul className="mt-3 hidden list-disc pl-5 text-xs text-muted sm:block">
          {(analytics.data?.analytics.totals.assumptions ?? []).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </GlassCard>
    </PageStack>
  );
}

function fmt(value: number | null | undefined, digits: number) {
  if (value == null || Number.isNaN(value)) return null;
  return value.toFixed(digits);
}
