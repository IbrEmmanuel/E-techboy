"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ComparisonChart, PowerChart } from "@/components/dashboard/charts";
import { GlassCard } from "@/components/glass-card";
import { ErrorState } from "@/components/empty-state";
import { MetricGrid, PageStack } from "@/components/layout/page";
import { useAnalytics, useMe } from "@/lib/client/hooks";

export default function AnalyticsPage() {
  const search = useSearchParams();
  const { data: me } = useMe();
  const siteId = search.get("siteId") ?? me?.user.sites[0]?.id ?? null;
  const [defaultRange] = useState(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 7 * 86400000);
    return { from: from.toISOString(), to: to.toISOString() };
  });
  const from = search.get("from") ?? defaultRange.from;
  const to = search.get("to") ?? defaultRange.to;
  const analytics = useAnalytics(siteId, from, to);
  const data = analytics.data?.analytics;

  if (analytics.error) return <ErrorState message={analytics.error.message} onRetry={() => analytics.mutate()} />;

  return (
    <PageStack>
      <MetricGrid>
        <GlassCard className="min-w-0">
          <p className="text-xs text-muted sm:text-sm">Energy</p>
          <p className="mt-2 text-2xl font-semibold sm:text-3xl">{data?.totals.energyKwh.toFixed(3) ?? "—"} kWh</p>
        </GlassCard>
        <GlassCard className="min-w-0">
          <p className="text-xs text-muted sm:text-sm">Peak / avg</p>
          <p className="mt-2 text-xl font-semibold sm:text-3xl">
            {data?.totals.peakPowerW.toFixed(0) ?? "—"} / {data?.totals.avgPowerW.toFixed(0) ?? "—"} W
          </p>
        </GlassCard>
        <GlassCard className="col-span-2 min-w-0 xl:col-span-1">
          <p className="text-xs text-muted sm:text-sm">Estimated cost</p>
          <p className="mt-2 text-2xl font-semibold sm:text-3xl">
            {data?.cost.amount.toFixed(2) ?? "—"} {data?.cost.currency ?? ""}
          </p>
        </GlassCard>
      </MetricGrid>
      <PowerChart data={data?.series ?? []} loading={!data && !analytics.error} />
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        <ComparisonChart title="Daily kWh" unit="kWh" data={data?.daily ?? []} xKey="day" yKey="energyKwh" />
        <ComparisonChart title="Monthly kWh" unit="kWh" data={data?.monthly ?? []} xKey="month" yKey="energyKwh" />
      </div>
      <GlassCard>
        <h2 className="font-semibold">Assumptions</h2>
        <p className="mt-1 text-xs text-muted">
          Timezone {data?.timezone ?? "UTC"} · incomplete {String(data?.totals.incomplete ?? true)}
        </p>
        <ul className="mt-3 list-disc pl-5 text-sm text-muted">
          {(data?.totals.assumptions ?? []).map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      </GlassCard>
    </PageStack>
  );
}
