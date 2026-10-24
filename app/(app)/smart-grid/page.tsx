"use client";

import { useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/glass-card";
import { ErrorState } from "@/components/empty-state";
import { MetricCard } from "@/components/dashboard/metric-card";
import { MetricGrid, PageHeader, PageStack, ResponsiveListItem } from "@/components/layout/page";
import { useMe, useSmartGrid } from "@/lib/client/hooks";

export default function SmartGridPage() {
  const search = useSearchParams();
  const { data: me } = useMe();
  const siteId = search.get("siteId") ?? me?.user.sites[0]?.id ?? null;
  const grid = useSmartGrid(siteId);

  if (grid.error) return <ErrorState message={grid.error.message} onRetry={() => grid.mutate()} />;

  const derived = grid.data?.derivedFromMeters;
  const snap = grid.data?.snapshot as
    | {
        voltageV?: number;
        frequencyHz?: number;
        activePowerW?: number;
        solarPowerW?: number;
        batterySocPct?: number;
        importEnergyKwh?: number;
        exportEnergyKwh?: number;
      }
    | null
    | undefined;
  const source = derived?.sourceDevice ?? (snap ? "grid snapshot" : "no data");
  const fmt = (v: number | null | undefined) =>
    v === null || v === undefined || Number.isNaN(v) ? null : Number(v.toFixed(3));

  return (
    <PageStack>
      <GlassCard>
        <PageHeader title="Smart grid" description={grid.data?.disclaimer} />
      </GlassCard>

      <MetricGrid>
        <MetricCard label="Voltage" value={fmt(snap?.voltageV ?? derived?.voltageV)} unit="V" source={source} simulated={derived?.simulated} />
        <MetricCard label="Frequency" value={fmt(snap?.frequencyHz ?? derived?.frequencyHz)} unit="Hz" source={source} simulated={derived?.simulated} />
        <MetricCard label="Power" value={fmt(snap?.activePowerW ?? derived?.activePowerW)} unit="W" source={source} simulated={derived?.simulated} />
        <MetricCard label="PF" value={fmt(derived?.powerFactor)} unit="" source={source} simulated={derived?.simulated} />
        <MetricCard label="Solar" value={fmt(snap?.solarPowerW)} unit="W" source={snap?.solarPowerW != null ? "snapshot" : "n/a"} />
        <MetricCard label="Battery" value={fmt(snap?.batterySocPct)} unit="%" source={snap?.batterySocPct != null ? "snapshot" : "n/a"} />
        <MetricCard label="Import" value={fmt(snap?.importEnergyKwh)} unit="kWh" source={snap?.importEnergyKwh != null ? "snapshot" : "n/a"} />
        <MetricCard label="Export" value={fmt(snap?.exportEnergyKwh)} unit="kWh" source={snap?.exportEnergyKwh != null ? "snapshot" : "n/a"} />
      </MetricGrid>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        <GlassCard>
          <h2 className="font-semibold">Site energy sources</h2>
          <div className="mt-3 space-y-2 text-sm">
            {(grid.data?.devices ?? []).map((d) => (
              <ResponsiveListItem key={d.id}>
                <span className="min-w-0 truncate">
                  {d.name} · {d.category}
                  {d.demoMode ? " · DEMO" : ""}
                </span>
                <span className="shrink-0 text-xs text-muted">{d.connectionState}</span>
              </ResponsiveListItem>
            ))}
            {(grid.data?.devices ?? []).length === 0 ? (
              <p className="text-muted">No grid-related devices registered yet.</p>
            ) : null}
          </div>
        </GlassCard>
        <GlassCard>
          <h2 className="font-semibold">Meter sample</h2>
          {derived ? (
            <div className="mt-3 space-y-1 text-sm">
              <p>Source: {derived.sourceDevice}</p>
              <p>Recorded: {new Date(derived.recordedAt).toLocaleString()}</p>
              <p>{derived.simulated ? "Simulated reading" : "Live stored reading"}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">No meter telemetry for this site.</p>
          )}
          <p className="mt-4 text-xs text-muted">
            Automatic islanding and protection-relay control are not cloud-only features.
          </p>
        </GlassCard>
      </div>
    </PageStack>
  );
}
