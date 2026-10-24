import { createStubAdapter } from "@/lib/protocols/adapters/stub";

export const bacnetAdapter = createStubAdapter({
  id: "bacnet_ip",
  name: "BACnet/IP",
  status: "stub",
  description: "BACnet/IP through suitable local gateway integrations for BMS telemetry.",
  notes: ["Discovery and COV subscriptions require a local BACnet stack on an authorized LAN."],
  capabilities: { discovery: true, telemetryRead: true, requiresGateway: true },
});
