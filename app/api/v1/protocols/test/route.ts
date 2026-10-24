import { requireUser } from "@/lib/auth/session";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { getProtocolAdapter } from "@/lib/protocols/registry";
import { protocolTestSchema } from "@/lib/validation/resources";

export async function POST(request: Request) {
  try {
    await requireUser();
    const body = protocolTestSchema.parse(await request.json());
    const adapter = getProtocolAdapter(body.protocol);
    if (!adapter) return jsonError("VALIDATION_ERROR", `Unknown protocol: ${body.protocol}`, 400);
    const validation = adapter.validateConfig(body.config);
    const connectivity = adapter.testConnectivity
      ? await adapter.testConnectivity(body.config)
      : { ok: validation.ok, message: validation.ok ? "Config valid" : validation.errors.join("; "), checkedAt: new Date().toISOString() };
    return jsonOk({
      protocol: adapter.id,
      status: adapter.descriptor.status,
      validation,
      connectivity,
      fabricated: false,
      note: connectivity.ok
        ? "Config validation passed. A successful result does not mean a live hardware session was opened unless a gateway reported it."
        : "Connectivity test did not succeed.",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
