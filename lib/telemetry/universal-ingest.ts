import "server-only";

import type { Device, ProtocolKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { allowSimulatedTelemetry } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { normalizeUniversalPayload, qualityToDb } from "@/lib/protocols/normalize";
import type { ProtocolId } from "@/lib/protocols/types";
import { getProtocolAdapter } from "@/lib/protocols/registry";
import { asJsonOrUndefined } from "@/lib/json";

const protocolMap: Record<string, ProtocolKind> = {
  mqtt: "MQTT",
  http: "HTTP",
  websocket: "WEBSOCKET",
  modbus_tcp: "MODBUS_TCP",
  modbus_rtu: "MODBUS_RTU",
  opc_ua: "OPC_UA",
  bacnet_ip: "BACNET_IP",
  lorawan: "LORAWAN",
  zigbee: "ZIGBEE",
  thread: "THREAD",
  ble: "BLE",
  can: "CAN",
  vendor_api: "VENDOR_API",
  custom: "CUSTOM",
};

function toProtocolId(kind: ProtocolKind): ProtocolId {
  return kind.toLowerCase() as ProtocolId;
}

export async function ingestUniversalTelemetry(device: Device, body: unknown, eventId: string) {
  const protocolId = toProtocolId(device.protocol);
  const adapter = getProtocolAdapter(protocolId);
  const normalized = adapter?.normalizeTelemetry
    ? adapter.normalizeTelemetry(body, device.publicId)
    : normalizeUniversalPayload(body, device.publicId, protocolId);

  const simulated = Boolean(normalized.metadata?.simulated);
  if (simulated && !allowSimulatedTelemetry()) {
    throw new HttpError("VALIDATION_ERROR", "Simulated telemetry is not accepted in this environment", 400);
  }

  const recordedAt = new Date(normalized.recorded_at);
  const dbProtocol = protocolMap[normalized.protocol] ?? device.protocol;

  const rows = normalized.measurements.map((m) => {
    const valueType =
      typeof m.value === "boolean" ? "BOOLEAN" : typeof m.value === "string" ? "STRING" : "NUMBER";
    return {
      deviceId: device.id,
      eventId,
      protocol: dbProtocol,
      recordedAt,
      schemaVersion: normalized.schema_version ?? 1,
      key: m.key,
      valueNumber: typeof m.value === "number" ? m.value : null,
      valueBool: typeof m.value === "boolean" ? m.value : null,
      valueText: typeof m.value === "string" ? m.value : null,
      valueType: valueType as "NUMBER" | "BOOLEAN" | "STRING" | "ENUM",
      unit: m.unit ?? null,
      quality: qualityToDb(m.quality),
      simulated,
      metadata: asJsonOrUndefined(normalized.metadata),
    };
  });

  try {
    await prisma.universalMeasurement.createMany({ data: rows });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Unique constraint") || (error as { code?: string }).code === "P2002") {
      return { duplicate: true, count: 0 };
    }
    throw error;
  }

  await prisma.device.update({
    where: { id: device.id },
    data: {
      lastSeenAt: recordedAt,
      lastSuccessfulAt: recordedAt,
      lastEventId: eventId,
      connectionState: "CONNECTED",
      lastError: null,
      status: device.status === "REVOKED" ? "REVOKED" : "ACTIVE",
      firmwareVersion:
        typeof normalized.metadata?.firmware === "string"
          ? normalized.metadata.firmware
          : device.firmwareVersion,
    },
  });

  await prisma.deviceEvent.create({
    data: {
      deviceId: device.id,
      type: "UNIVERSAL_TELEMETRY",
      payload: { eventId, keys: normalized.measurements.map((m) => m.key), protocol: normalized.protocol },
    },
  });

  await prisma.deviceConnectionLog.create({
    data: {
      deviceId: device.id,
      state: "CONNECTED",
      message: `Ingested ${rows.length} measurement(s)`,
    },
  });

  const {
    bagFromUniversalRows,
    mirrorUniversalToLegacy,
  } = await import("@/lib/telemetry/mirror");
  const bag = bagFromUniversalRows(rows);
  await mirrorUniversalToLegacy(device, eventId, recordedAt, bag, {
    simulated,
    firmwareVersion:
      typeof normalized.metadata?.firmware === "string" ? normalized.metadata.firmware : device.firmwareVersion,
  });

  const { snapshotExtrasFromBag, snapshotFromEnergyReading, writeGridSnapshot } = await import(
    "@/lib/smart-grid/snapshot"
  );
  const extras = snapshotExtrasFromBag(bag);
  if (bag.voltage != null && bag.active_power != null) {
    await writeGridSnapshot(
      device.siteId,
      {
        ...snapshotFromEnergyReading({
          recordedAt,
          voltageV: bag.voltage ?? bag.voltageV ?? 0,
          currentA: bag.current ?? bag.currentA ?? 0,
          frequencyHz: bag.frequency ?? bag.frequencyHz ?? 50,
          activePowerW: bag.active_power ?? bag.activePowerW ?? 0,
          powerFactor: bag.power_factor ?? bag.powerFactor ?? 1,
          energyWh: bag.energy ?? bag.energyWh ?? 0,
          simulated,
        }),
        ...extras,
      },
      device,
    );
  } else if (extras.solarPowerW != null || extras.batterySocPct != null) {
    await writeGridSnapshot(device.siteId, { recordedAt, ...extras, metadata: { simulated } }, device);
  }

  const { runAutomationAfterIngest } = await import("@/lib/automation/runner");
  await runAutomationAfterIngest(device, bag);

  return { duplicate: false, count: rows.length, normalized };
}
