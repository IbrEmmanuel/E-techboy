import { describe, expect, it } from "vitest";
import { decodeRegisterMap, decodeRegisters } from "@/lib/protocols/modbus/decode";
import { applyScale, normalizeUniversalPayload } from "@/lib/protocols/normalize";
import { listProtocolDescriptors, getProtocolAdapter } from "@/lib/protocols/registry";
import { mqttAdapter } from "@/lib/protocols/adapters/mqtt";
import { modbusTcpAdapter } from "@/lib/protocols/adapters/modbus-tcp";

describe("protocol registry", () => {
  it("lists adapters with truthful capability status", () => {
    const list = listProtocolDescriptors();
    expect(list.length).toBeGreaterThanOrEqual(10);
    expect(list.find((p) => p.id === "http")?.status).toBe("implemented");
    expect(list.find((p) => p.id === "opc_ua")?.status).toBe("stub");
    expect(list.find((p) => p.id === "modbus_tcp")?.status).toBe("gateway_required");
  });
});

describe("telemetry normalization", () => {
  it("normalizes universal payload and applies scale", () => {
    expect(applyScale(100, 0.1)).toBe(10);
    const normalized = normalizeUniversalPayload(
      {
        device_id: "device-001",
        recorded_at: new Date().toISOString(),
        measurements: [{ key: "voltage", value: 2301, unit: "V", scale: 0.1, quality: "good" }],
      },
      "device-001",
      "http",
    );
    expect(normalized.measurements[0].value).toBeCloseTo(230.1);
  });

  it("rejects mismatched device id and future timestamps", () => {
    expect(() =>
      normalizeUniversalPayload(
        {
          device_id: "other",
          recorded_at: new Date().toISOString(),
          measurements: [{ key: "x", value: 1 }],
        },
        "device-001",
        "http",
      ),
    ).toThrow(/device_id/);

    const future = new Date(Date.now() + 60 * 60_000).toISOString();
    expect(() =>
      normalizeUniversalPayload(
        {
          device_id: "device-001",
          recorded_at: future,
          measurements: [{ key: "x", value: 1 }],
        },
        "device-001",
        "http",
      ),
    ).toThrow(/future/);
  });

  it("maps legacy energy payloads", () => {
    const normalized = normalizeUniversalPayload(
      {
        deviceId: "esp32_demo",
        timestamp: new Date().toISOString(),
        measurements: {
          voltageV: 230,
          currentA: 1,
          activePowerW: 230,
          energyWh: 10,
          quality: "GOOD",
        },
      },
      "esp32_demo",
      "http",
    );
    expect(normalized.measurements.some((m) => m.key === "voltage")).toBe(true);
  });
});

describe("modbus decoding", () => {
  it("decodes uint16 with scale", () => {
    const value = decodeRegisters([2301], { key: "voltage", address: 0, type: "uint16", scale: 0.1 });
    expect(value).toBeCloseTo(230.1);
  });

  it("decodes register maps", () => {
    const rows = decodeRegisterMap([2300, 125, 0, 500], [
      { key: "voltage", address: 0, type: "uint16", scale: 0.1, unit: "V" },
      { key: "current", address: 1, type: "uint16", scale: 0.01, unit: "A" },
    ]);
    expect(rows[0].value).toBeCloseTo(230);
    expect(rows[1].value).toBeCloseTo(1.25);
  });
});

describe("mqtt/modbus config validation", () => {
  it("validates mqtt config without claiming live connect", async () => {
    const result = mqttAdapter.validateConfig({
      brokerUrl: "mqtts://broker.example.com",
      topicNamespace: "org/site",
      telemetryTopic: "org/site/+/telemetry",
      qos: 1,
      tls: true,
    });
    expect(result.ok).toBe(true);
    const connectivity = await mqttAdapter.testConnectivity!({
      brokerUrl: "mqtts://broker.example.com",
      topicNamespace: "org/site",
      telemetryTopic: "org/site/+/telemetry",
    });
    expect(connectivity.message.toLowerCase()).toContain("gateway");
  });

  it("rejects incomplete modbus maps", () => {
    const bad = modbusTcpAdapter.validateConfig({ host: "10.0.0.5", registers: [] });
    expect(bad.ok).toBe(false);
  });

  it("returns stub adapter for opc ua", async () => {
    const opc = getProtocolAdapter("opc_ua");
    expect(opc?.descriptor.status).toBe("stub");
    const test = await opc!.testConnectivity!({});
    expect(test.ok).toBe(false);
  });
});
