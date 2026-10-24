import { requireUser } from "@/lib/auth/session";
import { listPlans } from "@/lib/billing/entitlements";
import { handleRouteError, jsonOk } from "@/lib/http";

export async function GET() {
  try {
    await requireUser();
    return jsonOk({
      plans: listPlans(),
      note: "Feature limits are enforced on the server. Do not charge for unimplemented capabilities.",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
