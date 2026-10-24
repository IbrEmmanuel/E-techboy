import { requireUser } from "@/lib/auth/session";
import { requireSiteRole } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { handleRouteError, jsonOk } from "@/lib/http";
import { siteCreateSchema } from "@/lib/validation/resources";

export async function GET(_: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const user = await requireUser();
    const { siteId } = await context.params;
    await requireSiteRole(user, siteId);
    const site = await prisma.site.findUniqueOrThrow({
      where: { id: siteId },
      include: { circuits: true, devices: true, tariffs: true, alertRules: true },
    });
    return jsonOk({ site });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const user = await requireUser();
    const { siteId } = await context.params;
    await requireSiteRole(user, siteId, "ADMIN");
    const body = siteCreateSchema.partial().parse(await request.json());
    const site = await prisma.site.update({ where: { id: siteId }, data: body });
    return jsonOk({ site });
  } catch (error) {
    return handleRouteError(error);
  }
}
