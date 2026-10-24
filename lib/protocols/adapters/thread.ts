import { createStubAdapter } from "@/lib/protocols/adapters/stub";

export const threadAdapter = createStubAdapter({
  id: "thread",
  name: "Thread",
  status: "planned",
  description: "Thread devices via border router / Matter-compatible gateways.",
  notes: ["Requires Thread border router hardware and commissioning workflow."],
});
