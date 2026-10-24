import { describe, expect, it } from "vitest";
import { telemetryIngestSchema } from "@/lib/validation/telemetry";
import { isRoleAtLeast } from "@/lib/auth/roles";
import { loginSchema } from "@/lib/validation/auth";

const valid = {
  deviceId: "esp32_demo000001",
  eventId: "11111111-1111-4111-8111-111111111111",
  timestamp: "2026-01-01T00:00:00.000Z",
  schemaVersion: 1,
  measurements: {
    voltageV: 230.1,
    currentA: 1.25,
    activePowerW: 280,
    powerFactor: 0.98,
    frequencyHz: 50.02,
    energyWh: 12500,
    quality: "GOOD" as const,
  },
};

describe("telemetry validation", () => {
  it("accepts a documented firmware payload", () => {
    expect(telemetryIngestSchema.parse(valid).deviceId).toBe("esp32_demo000001");
  });

  it("rejects invalid measurements", () => {
    expect(() =>
      telemetryIngestSchema.parse({
        ...valid,
        measurements: { ...valid.measurements, voltageV: -1 },
      }),
    ).toThrow();
  });
});

describe("authorization helpers", () => {
  it("enforces role rank for tenant actions", () => {
    expect(isRoleAtLeast("VIEWER", "ADMIN")).toBe(false);
    expect(isRoleAtLeast("OWNER", "ADMIN")).toBe(true);
  });
});

describe("login validation", () => {
  it("rejects short passwords", () => {
    expect(() => loginSchema.parse({ email: "a@b.com", password: "short" })).toThrow();
  });
});
