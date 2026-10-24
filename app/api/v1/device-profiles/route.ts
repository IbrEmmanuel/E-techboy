import { requireUser } from "@/lib/auth/session";
import { DEVICE_CATEGORIES, DEVICE_PROFILES } from "@/lib/devices/profiles";
import { handleRouteError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await requireUser();
    const stored = await prisma.deviceModelProfile.findMany({ orderBy: [{ manufacturer: "asc" }, { model: "asc" }] });
    return jsonOk({
      categories: DEVICE_CATEGORIES,
      profiles: stored.length
        ? stored
        : DEVICE_PROFILES.map((p, i) => ({
            id: `catalog-${i}`,
            ...p,
            catalogOnly: true,
          })),
      compatibilityNote:
        "Compatibility depends on interface, protocol, firmware, gateway, vendor API, and documentation. Not every device is automatically compatible.",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
