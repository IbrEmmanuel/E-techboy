"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassCard } from "@/components/glass-card";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export function PowerChart({
  data,
  loading,
}: {
  data: { t: string; w: number; simulated?: boolean }[];
  loading?: boolean;
}) {
  return (
    <GlassCard className="relative z-0 h-[260px] overflow-hidden sm:h-[340px]">
      <div className="mb-3 flex items-center justify-between sm:mb-4">
        <div>
          <h2 className="text-base font-semibold sm:text-lg">Real-time power</h2>
          <p className="text-xs text-muted">Active power (W) from stored readings</p>
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-[170px] w-full sm:h-[250px]" />
      ) : data.length === 0 ? (
        <EmptyState title="No power samples" body="Ingest telemetry from an ESP32 or the documented simulator." />
      ) : (
        <div className="h-[170px] sm:h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
              <XAxis dataKey="t" tickFormatter={(v) => new Date(v).toLocaleTimeString()} minTickGap={32} tick={{ fontSize: 11 }} />
              <YAxis unit=" W" width={44} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => [`${value} W`, "Active power"]}
                labelFormatter={(label) => new Date(String(label)).toISOString()}
              />
              <Area type="monotone" dataKey="w" stroke="#0f766e" fill="#0f766e" fillOpacity={0.18} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </GlassCard>
  );
}

export function ComparisonChart({
  title,
  unit,
  data,
  xKey,
  yKey,
  loading,
}: {
  title: string;
  unit: string;
  data: Record<string, string | number | boolean>[];
  xKey: string;
  yKey: string;
  loading?: boolean;
}) {
  return (
    <GlassCard className="relative z-0 h-[250px] overflow-hidden sm:h-[320px]">
      <h2 className="mb-1 text-base font-semibold sm:text-lg">{title}</h2>
      <p className="mb-3 text-xs text-muted sm:mb-4">From historical telemetry</p>
      {loading ? (
        <Skeleton className="h-[160px] w-full sm:h-[230px]" />
      ) : data.length === 0 ? (
        <EmptyState title="No comparison data" body="Select a date range that contains stored readings." />
      ) : (
        <div className="h-[160px] sm:h-[230px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
              <YAxis unit={` ${unit}`} width={44} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [`${value} ${unit}`, title]} />
              <Bar dataKey={yKey} fill="#d97706" radius={[8, 8, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </GlassCard>
  );
}
