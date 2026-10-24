import { requireUser } from "@/lib/auth/session";
import { requireSiteRole } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { ackSchema } from "@/lib/validation/resources";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ alertId: string }> }) {
  try {
    const user = await requireUser();
    const { alertId } = await context.params;
    const alert = await prisma.alert.findUnique({ where: { id: alertId } });
    if (!alert) return jsonError("NOT_FOUND", "Alert not found", 404);
    await requireSiteRole(user, alert.siteId, "OPERATOR");
    const body = ackSchema.parse(await request.json().catch(() => ({})));
    await prisma.$transaction([
      prisma.alert.update({ where: { id: alertId }, data: { status: "ACKNOWLEDGED" } }),
      prisma.alertAcknowledgement.create({
        data: { alertId, userId: user.id, note: body.note },
      }),
    ]);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
