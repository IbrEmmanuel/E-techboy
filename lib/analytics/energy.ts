import Decimal from "decimal.js";
import { dayKeyInTimeZone, monthKeyInTimeZone } from "@/lib/utils";

export type PowerSample = {
  eventId: string;
  recordedAt: Date;
  activePowerW: number;
  energyWh: number;
  quality: "GOOD" | "ESTIMATED" | "SUSPECT" | "INVALID";
};

export type EnergyComputation = {
  energyWh: Decimal;
  energyKwh: Decimal;
  peakPowerW: Decimal;
  avgPowerW: Decimal;
  method: "CUMULATIVE" | "INTEGRATED" | "MIXED";
  incomplete: boolean;
  resets: number;
  duplicateCount: number;
  gaps: { start: Date; end: Date; seconds: number }[];
  sampleCount: number;
  assumptions: string[];
};

const RESET_DROP_WH = 10;
const RESET_DROP_RATIO = 0.5;

export function computeEnergy(samples: PowerSample[], options?: { maxGapSeconds?: number }): EnergyComputation {
  const assumptions = [
    "Timestamps are interpreted as UTC instants.",
    "Cumulative meter energy is preferred when consecutive samples increase.",
    "Power is integrated using the actual interval between samples, not a fixed period.",
    "Missing intervals are not treated as zero consumption.",
    "Invalid-quality samples are excluded from totals.",
  ];

  const seen = new Set<string>();
  let duplicateCount = 0;
  const sorted = [...samples]
    .filter((s) => {
      if (seen.has(s.eventId)) {
        duplicateCount += 1;
        return false;
      }
      seen.add(s.eventId);
      return s.quality !== "INVALID";
    })
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

  if (sorted.length === 0) {
    return {
      energyWh: new Decimal(0),
      energyKwh: new Decimal(0),
      peakPowerW: new Decimal(0),
      avgPowerW: new Decimal(0),
      method: "CUMULATIVE",
      incomplete: true,
      resets: 0,
      duplicateCount,
      gaps: [],
      sampleCount: 0,
      assumptions: [...assumptions, "No valid samples were available for this period."],
    };
  }

  const intervals: { dtSeconds: number; dEnergyWh: Decimal; powerW: Decimal; method: "CUMULATIVE" | "INTEGRATED" }[] = [];
  const gaps: EnergyComputation["gaps"] = [];
  let resets = 0;
  let usedCumulative = 0;
  let usedIntegrated = 0;
  const maxGap = options?.maxGapSeconds ?? inferMaxGap(sorted);

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const dtSeconds = (curr.recordedAt.getTime() - prev.recordedAt.getTime()) / 1000;
    if (dtSeconds <= 0) continue;
    if (dtSeconds > maxGap) {
      gaps.push({ start: prev.recordedAt, end: curr.recordedAt, seconds: dtSeconds });
      continue;
    }

    const drop = prev.energyWh - curr.energyWh;
    const reset = drop > RESET_DROP_WH && curr.energyWh < prev.energyWh * RESET_DROP_RATIO;
    if (reset) {
      resets += 1;
      const integrated = new Decimal(prev.activePowerW).plus(curr.activePowerW).div(2).mul(dtSeconds).div(3600);
      intervals.push({ dtSeconds, dEnergyWh: integrated, powerW: new Decimal(curr.activePowerW), method: "INTEGRATED" });
      usedIntegrated += 1;
      continue;
    }

    if (curr.energyWh >= prev.energyWh) {
      intervals.push({
        dtSeconds,
        dEnergyWh: new Decimal(curr.energyWh).minus(prev.energyWh),
        powerW: new Decimal(curr.activePowerW),
        method: "CUMULATIVE",
      });
      usedCumulative += 1;
    } else {
      const integrated = new Decimal(prev.activePowerW).plus(curr.activePowerW).div(2).mul(dtSeconds).div(3600);
      intervals.push({ dtSeconds, dEnergyWh: integrated, powerW: new Decimal(curr.activePowerW), method: "INTEGRATED" });
      usedIntegrated += 1;
    }
  }

  const energyWh = intervals.reduce((acc, row) => acc.plus(row.dEnergyWh), new Decimal(0));
  const weightedPower = intervals.reduce((acc, row) => acc.plus(row.powerW.mul(row.dtSeconds)), new Decimal(0));
  const totalSeconds = intervals.reduce((acc, row) => acc + row.dtSeconds, 0);
  const peakPowerW = sorted.reduce((acc, s) => Decimal.max(acc, new Decimal(s.activePowerW)), new Decimal(0));
  const method = usedCumulative && usedIntegrated ? "MIXED" : usedIntegrated ? "INTEGRATED" : "CUMULATIVE";

  return {
    energyWh,
    energyKwh: energyWh.div(1000),
    peakPowerW,
    avgPowerW: totalSeconds > 0 ? weightedPower.div(totalSeconds) : new Decimal(0),
    method,
    incomplete: gaps.length > 0 || sorted.length < 2,
    resets,
    duplicateCount,
    gaps,
    sampleCount: sorted.length,
    assumptions,
  };
}

function inferMaxGap(samples: PowerSample[]): number {
  // Prefer typical short poll intervals; ignore multi-hour gaps when inferring the threshold.
  const dts: number[] = [];
  for (let i = 1; i < samples.length; i += 1) {
    const dt = (samples[i].recordedAt.getTime() - samples[i - 1].recordedAt.getTime()) / 1000;
    if (dt > 0 && dt <= 3600) dts.push(dt);
  }
  if (dts.length === 0) return 6 * 3600;
  dts.sort((a, b) => a - b);
  const median = dts[Math.floor(dts.length / 2)] ?? 30;
  return Math.max(120, median * 4);
}

export function bucketByDay(samples: PowerSample[], timeZone: string) {
  const buckets = new Map<string, PowerSample[]>();
  for (const sample of samples) {
    const key = dayKeyInTimeZone(sample.recordedAt, timeZone);
    const list = buckets.get(key) ?? [];
    list.push(sample);
    buckets.set(key, list);
  }
  return [...buckets.entries()].map(([day, rows]) => ({ day, ...computeEnergy(rows) }));
}

export function bucketByMonth(samples: PowerSample[], timeZone: string) {
  const buckets = new Map<string, PowerSample[]>();
  for (const sample of samples) {
    const key = monthKeyInTimeZone(sample.recordedAt, timeZone);
    const list = buckets.get(key) ?? [];
    list.push(sample);
    buckets.set(key, list);
  }
  return [...buckets.entries()].map(([month, rows]) => ({ month, ...computeEnergy(rows) }));
}
