import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { handleRouteError, jsonOk } from "@/lib/http";
import { profileUpdateSchema } from "@/lib/validation/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const full = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { preferences: true, memberships: { include: { site: true } } },
    });
    return jsonOk({
      user: {
        id: full.id,
        email: full.email,
        name: full.name,
        role: full.globalRole,
        sites: full.memberships.map((m) => ({
          id: m.site.id,
          name: m.site.name,
          role: m.role,
          timezone: m.site.timezone,
          currency: m.site.currency,
        })),
        preferences: full.preferences,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = profileUpdateSchema.parse(await request.json());
    await prisma.user.update({
      where: { id: user.id },
      data: { name: body.name },
    });
    await prisma.userPreference.upsert({
      where: { userId: user.id },
      update: {
        theme: body.theme,
        defaultSiteId: body.defaultSiteId ?? undefined,
        notifyEmail: body.notifyEmail,
      },
      create: {
        userId: user.id,
        theme: body.theme ?? "system",
        defaultSiteId: body.defaultSiteId ?? undefined,
        notifyEmail: body.notifyEmail ?? false,
      },
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
