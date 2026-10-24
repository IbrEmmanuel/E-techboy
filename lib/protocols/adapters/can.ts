import { createStubAdapter } from "@/lib/protocols/adapters/stub";

export const canAdapter = createStubAdapter({
  id: "can",
  name: "CAN bus",
  status: "planned",
  description: "CAN bus telemetry through compatible gateway hardware (SocketCAN, USB-CAN).",
  notes: ["Requires physical CAN interface and DBC/message definitions."],
});
