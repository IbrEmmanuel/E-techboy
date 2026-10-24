import type { ProtocolAdapter, ProtocolDescriptor, ProtocolId } from "@/lib/protocols/types";
import { mqttAdapter } from "@/lib/protocols/adapters/mqtt";
import { httpAdapter } from "@/lib/protocols/adapters/http";
import { websocketAdapter } from "@/lib/protocols/adapters/websocket";
import { modbusTcpAdapter } from "@/lib/protocols/adapters/modbus-tcp";
import { modbusRtuAdapter } from "@/lib/protocols/adapters/modbus-rtu";
import { opcUaAdapter } from "@/lib/protocols/adapters/opc-ua";
import { bacnetAdapter } from "@/lib/protocols/adapters/bacnet";
import { lorawanAdapter } from "@/lib/protocols/adapters/lorawan";
import { zigbeeAdapter } from "@/lib/protocols/adapters/zigbee";
import { threadAdapter } from "@/lib/protocols/adapters/thread";
import { bleAdapter } from "@/lib/protocols/adapters/ble";
import { canAdapter } from "@/lib/protocols/adapters/can";
import { vendorApiAdapter } from "@/lib/protocols/adapters/vendor-api";
import { customAdapter } from "@/lib/protocols/adapters/custom";

const adapters: ProtocolAdapter[] = [
  mqttAdapter,
  httpAdapter,
  websocketAdapter,
  modbusTcpAdapter,
  modbusRtuAdapter,
  opcUaAdapter,
  bacnetAdapter,
  lorawanAdapter,
  zigbeeAdapter,
  threadAdapter,
  bleAdapter,
  canAdapter,
  vendorApiAdapter,
  customAdapter,
];

const byId = new Map(adapters.map((a) => [a.id, a]));

export function listProtocolAdapters(): ProtocolAdapter[] {
  return [...adapters];
}

export function listProtocolDescriptors(): ProtocolDescriptor[] {
  return adapters.map((a) => a.descriptor);
}

export function getProtocolAdapter(id: ProtocolId | string): ProtocolAdapter | undefined {
  return byId.get(id as ProtocolId);
}

export function assertProtocolAdapter(id: ProtocolId | string): ProtocolAdapter {
  const adapter = getProtocolAdapter(id);
  if (!adapter) {
    throw new Error(`Unknown protocol: ${id}`);
  }
  return adapter;
}
