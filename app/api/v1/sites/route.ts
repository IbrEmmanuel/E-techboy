import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { siteCreateSchema } from "@/lib/validation/resources";
import { handleRouteError, jsonOk } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireUser();
    const memberships = await prisma.siteMembership.findMany({
      where: { userId: user.id },
      include: { site: true },
    });
    return jsonOk({
      sites: memberships.map((m) => ({ ...m.site, role: m.role })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = siteCreateSchema.parse(await request.json());
    const site = await prisma.site.create({
      data: {
        name: body.name,
        timezone: body.timezone,
        currency: body.currency,
        memberships: { create: { userId: user.id, role: "OWNER" } },
      },
    });
    await prisma.auditLog.create({
      data: { userId: user.id, action: "SITE_CREATE", entityType: "Site", entityId: site.id },
    });
    return jsonOk({ site }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
