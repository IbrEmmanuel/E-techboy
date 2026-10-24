import { createStubAdapter } from "@/lib/protocols/adapters/stub";

export const bleAdapter = createStubAdapter({
  id: "ble",
  name: "Bluetooth Low Energy",
  status: "planned",
  description: "BLE sensors/actuators through a local gateway with radio access.",
  notes: ["Browsers cannot maintain industrial BLE sessions for this product."],
});
