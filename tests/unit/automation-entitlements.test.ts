import { describe, expect, it } from "vitest";
import { dryRunAutomation, evaluateConditions } from "@/lib/automation/engine";
import { entitlementsFor, assertWithinLimit, listPlans } from "@/lib/billing/entitlements";

describe("automation engine", () => {
  it("evaluates AND/OR conditions", () => {
    expect(
      evaluateConditions(
        {
          logic: "and",
          items: [
            { measurementKey: "active_power", operator: "gt", value: 100 },
            { measurementKey: "voltage", operator: "lt", value: 250 },
          ],
        },
        { active_power: 150, voltage: 230 },
      ),
    ).toBe(true);

    expect(
      evaluateConditions(
        {
          logic: "or",
          items: [
            { measurementKey: "battery_soc", operator: "lt", value: 20 },
            { measurementKey: "grid_available", operator: "eq", value: false },
          ],
        },
        { battery_soc: 55, grid_available: false },
      ),
    ).toBe(true);
  });

  it("dry-runs control actions without submitting commands", () => {
    const result = dryRunAutomation(
      {
        kind: "CONTROL",
        requireApproval: true,
        trigger: { type: "measurement_threshold", measurementKey: "active_power", operator: "gt", value: 1000 },
        conditions: { logic: "and", items: [] },
        actions: [{ type: "request_command", commandType: "OPEN_RELAY" }],
      },
      { measurements: { active_power: 1500 } },
      true,
    );
    expect(result.matched).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.blockedReason).toMatch(/approval|dry-run/i);
    expect(result.safetyNote).toMatch(/interlocks|e-stops/i);
  });
});

describe("subscription entitlements", () => {
  it("exposes configurable plans", () => {
    expect(listPlans().length).toBe(5);
    expect(entitlementsFor("FREE_DEMO").realDevices).toBe(false);
    expect(entitlementsFor("INDUSTRIAL").industrialProtocols).toBe(true);
  });

  it("enforces device limits server-side helper", () => {
    expect(() => assertWithinLimit(3, 3, "Devices")).toThrow(/limit/i);
    expect(() => assertWithinLimit(2, 3, "Devices")).not.toThrow();
  });
});
