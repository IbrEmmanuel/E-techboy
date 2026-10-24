import { describe, expect, it } from "vitest";
import { evaluateReading, fingerprintFor } from "@/lib/alerts/evaluate";

const rule = {
  id: "rule1",
  type: "OVERVOLTAGE" as const,
  severity: "WARNING" as const,
  enabled: true,
  voltageHighV: 250,
  voltageLowV: null,
  currentHighA: null,
  powerHighW: null,
  energyHighKwh: null,
  hysteresisPercent: 2,
  sustainSeconds: 0,
  cooldownSeconds: 300,
};

describe("evaluateReading", () => {
  it("opens overvoltage and resolves after hysteresis recovery", () => {
    const open = evaluateReading({
      deviceId: "dev1",
      reading: {
        voltageV: 260,
        currentA: 1,
        activePowerW: 200,
        energyWh: 10,
        quality: "GOOD",
        recordedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      rules: [rule],
      openAlerts: [],
    });
    expect(open[0]?.action).toBe("open");

    const recovered = evaluateReading({
      deviceId: "dev1",
      reading: {
        voltageV: 240,
        currentA: 1,
        activePowerW: 200,
        energyWh: 10,
        quality: "GOOD",
        recordedAt: new Date("2026-01-01T00:05:00.000Z"),
      },
      rules: [rule],
      openAlerts: [{ fingerprint: fingerprintFor("dev1", "OVERVOLTAGE", "rule1"), type: "OVERVOLTAGE", openedAt: new Date("2026-01-01T00:00:00.000Z"), lastSeenAt: new Date("2026-01-01T00:00:00.000Z") }],
    });
    expect(recovered.some((d) => d.action === "resolve")).toBe(true);
  });

  it("opens invalid measurement alerts for sensor failures", () => {
    const decisions = evaluateReading({
      deviceId: "dev1",
      reading: {
        voltageV: 0,
        currentA: 0,
        activePowerW: 0,
        energyWh: 0,
        quality: "INVALID",
        recordedAt: new Date(),
      },
      rules: [],
      openAlerts: [],
    });
    const first = decisions[0];
    expect(first && "type" in first ? first.type : undefined).toBe("INVALID_MEASUREMENT");
  });
});
