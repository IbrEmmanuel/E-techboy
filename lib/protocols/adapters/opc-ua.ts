import { createStubAdapter } from "@/lib/protocols/adapters/stub";

export const opcUaAdapter = createStubAdapter({
  id: "opc_ua",
  name: "OPC UA",
  status: "stub",
  description: "OPC UA client integration for industrial servers (requires edge worker + certificates).",
  notes: [
    "Needs a long-running OPC UA client library and trust store on the gateway.",
    "Validate vendor endpoint, security policy, and user token types per server.",
  ],
  capabilities: { telemetryRead: true, healthCheck: true, requiresGateway: true },
});
