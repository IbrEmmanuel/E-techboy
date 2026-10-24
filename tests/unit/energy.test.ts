import { describe, expect, it } from "vitest";
import { computeEnergy } from "@/lib/analytics/energy";
import { applyTariff, costForPeriod } from "@/lib/analytics/tariff";
import Decimal from "decimal.js";

function sample(partial: { eventId: string; t: string; w: number; wh: number; quality?: "GOOD" | "INVALID" }) {
  return {
    eventId: partial.eventId,
    recordedAt: new Date(partial.t),
    activePowerW: partial.w,
    energyWh: partial.wh,
    quality: partial.quality ?? "GOOD",
  };
}

describe("computeEnergy", () => {
  it("uses cumulative meter deltas in Wh and converts to kWh", () => {
    const result = computeEnergy([
      sample({ eventId: "1", t: "2026-01-01T00:00:00.000Z", w: 1000, wh: 0 }),
      sample({ eventId: "2", t: "2026-01-01T01:00:00.000Z", w: 1000, wh: 1000 }),
    ]);
    expect(result.energyWh.toNumber()).toBe(1000);
    expect(result.energyKwh.toNumber()).toBe(1);
    expect(result.method).toBe("CUMULATIVE");
    expect(result.incomplete).toBe(false);
  });

  it("integrates power over actual intervals when cumulative drops without a full reset", () => {
    const result = computeEnergy([
      sample({ eventId: "1", t: "2026-01-01T00:00:00.000Z", w: 1000, wh: 100 }),
      sample({ eventId: "2", t: "2026-01-01T00:30:00.000Z", w: 1000, wh: 90 }),
    ]);
    expect(result.method).toBe("INTEGRATED");
    expect(result.energyWh.toNumber()).toBeCloseTo(500, 6);
  });

  it("detects meter resets and does not treat missing gaps as zero", () => {
    const result = computeEnergy([
      sample({ eventId: "1", t: "2026-01-01T00:00:00.000Z", w: 500, wh: 2000 }),
      sample({ eventId: "2", t: "2026-01-01T00:01:00.000Z", w: 500, wh: 5 }),
      sample({ eventId: "3", t: "2026-01-01T03:00:00.000Z", w: 500, wh: 10 }),
    ]);
    expect(result.resets).toBe(1);
    expect(result.gaps.length).toBeGreaterThan(0);
    expect(result.incomplete).toBe(true);
  });

  it("drops duplicate event IDs and invalid quality samples", () => {
    const result = computeEnergy([
      sample({ eventId: "dup", t: "2026-01-01T00:00:00.000Z", w: 100, wh: 0 }),
      sample({ eventId: "dup", t: "2026-01-01T00:01:00.000Z", w: 9999, wh: 9999 }),
      sample({ eventId: "bad", t: "2026-01-01T00:02:00.000Z", w: 100, wh: 10, quality: "INVALID" }),
      sample({ eventId: "ok", t: "2026-01-01T00:10:00.000Z", w: 100, wh: 20 }),
    ]);
    expect(result.duplicateCount).toBe(1);
    expect(result.sampleCount).toBe(2);
  });
});

describe("tariff", () => {
  it("applies the rate effective at the timestamp using decimal money", () => {
    const cost = applyTariff(2.5, new Date("2026-06-01T00:00:00.000Z"), [
      { ratePerKwh: "0.180000", effectiveFrom: new Date("2026-01-01T00:00:00.000Z"), effectiveTo: null },
    ], "USD");
    expect(cost.amount.equals(new Decimal("0.4500"))).toBe(true);
    expect(cost.estimated).toBe(true);
  });

  it("marks cost incomplete when a slice has no tariff", () => {
    const cost = costForPeriod(
      [{ start: new Date("2026-01-01T00:00:00.000Z"), end: new Date("2026-01-02T00:00:00.000Z"), energyKwh: 1 }],
      [],
      "USD",
      false,
    );
    expect(cost.incomplete).toBe(true);
    expect(cost.amount.toNumber()).toBe(0);
  });
});
