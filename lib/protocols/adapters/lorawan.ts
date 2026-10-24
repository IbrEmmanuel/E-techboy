import { createStubAdapter } from "@/lib/protocols/adapters/stub";

export const lorawanAdapter = createStubAdapter({
  id: "lorawan",
  name: "LoRaWAN",
  status: "planned",
  description: "LoRaWAN via supported network-server webhooks (TTN, ChirpStack, etc.).",
  notes: ["Requires network-server credentials and payload decoders per device profile."],
  capabilities: { telemetryRead: true, requiresGateway: false },
});
