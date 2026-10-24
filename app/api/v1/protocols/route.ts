import { requireUser } from "@/lib/auth/session";
import { handleRouteError, jsonOk } from "@/lib/http";
import { listProtocolDescriptors } from "@/lib/protocols/registry";

export async function GET() {
  try {
    await requireUser();
    return jsonOk({
      protocols: listProtocolDescriptors(),
      note: "Capability status is truthful. Stub/planned protocols need hardware, credentials, or adapter work.",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
