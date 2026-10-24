"use client";

import { GlassCard } from "@/components/glass-card";
import { Skeleton } from "@/components/ui/skeleton";

export function MetricCard({
  label,
  value,
  unit,
  source,
  loading,
  simulated,
  hint,
}: {
  label: string;
  value: string | number | null;
  unit: string;
  source: string;
  loading?: boolean;
  simulated?: boolean;
  hint?: string;
}) {
  return (
    <GlassCard className="min-h-[104px] sm:min-h-[132px]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted sm:text-sm">{label}</p>
        {simulated ? (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-800 dark:bg-amber-400/20 dark:text-amber-200 sm:px-2 sm:text-[10px]">
            Sim
          </span>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-20 sm:mt-4 sm:h-10 sm:w-24" />
      ) : (
        <p className="mt-2 text-2xl font-semibold tracking-tight sm:mt-3 sm:text-3xl">
          {value ?? "—"}
          <span className="ml-1 text-sm font-normal text-muted sm:text-base">{unit}</span>
        </p>
      )}
      <p className="mt-2 truncate text-[10px] text-muted sm:mt-3 sm:text-[11px]" title={hint}>
        {source}
        {hint ? ` · ${hint}` : ""}
      </p>
    </GlassCard>
  );
}
