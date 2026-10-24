import { createStubAdapter } from "@/lib/protocols/adapters/stub";

export const zigbeeAdapter = createStubAdapter({
  id: "zigbee",
  name: "Zigbee",
  status: "planned",
  description: "Zigbee devices through compatible coordinators/gateways.",
  notes: ["Requires a Zigbee coordinator on the local gateway; no cloud-direct pairing."],
});
