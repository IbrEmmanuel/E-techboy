import type { AdapterCapability, CapabilityStatus, ProtocolAdapter, ProtocolId } from "@/lib/protocols/types";

export function createStubAdapter(opts: {
  id: ProtocolId;
  name: string;
  status: CapabilityStatus;
  description: string;
  notes: string[];
  capabilities?: Partial<AdapterCapability>;
}): ProtocolAdapter {
  const capabilities: AdapterCapability = {
    discovery: false,
    telemetryRead: false,
    commands: false,
    writes: false,
    healthCheck: false,
    requiresGateway: true,
    ...opts.capabilities,
  };
  return {
    id: opts.id,
    descriptor: {
      id: opts.id,
      name: opts.name,
      status: opts.status,
      description: opts.description,
      capabilities,
      notes: opts.notes,
    },
    validateConfig() {
      return {
        ok: false,
        errors: [
          `${opts.name} adapter is ${opts.status}. Provide vendor docs, gateway, and credentials before enabling production use.`,
        ],
        warnings: opts.notes,
      };
    },
    async testConnectivity() {
      return {
        ok: false,
        message: `${opts.name} is not fully implemented in this build. See docs/protocols.md for the adapter development guide.`,
        checkedAt: new Date().toISOString(),
      };
    },
  };
}
