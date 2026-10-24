import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { requireSiteRole } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { tariffCreateSchema } from "@/lib/validation/resources";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const siteId = new URL(request.url).searchParams.get("siteId");
    if (!siteId) return jsonError("VALIDATION_ERROR", "siteId is required", 400);
    await requireSiteRole(user, siteId);
    const tariffs = await prisma.tariff.findMany({
      where: { siteId },
      include: { history: true },
      orderBy: { effectiveFrom: "desc" },
    });
    return jsonOk({ tariffs });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const siteId = new URL(request.url).searchParams.get("siteId");
    if (!siteId) return jsonError("VALIDATION_ERROR", "siteId is required", 400);
    await requireSiteRole(user, siteId, "ADMIN");
    const body = tariffCreateSchema.parse(await request.json());
    const tariff = await prisma.tariff.create({
      data: {
        siteId,
        name: body.name,
        currency: body.currency,
        ratePerKwh: new Prisma.Decimal(body.ratePerKwh),
        effectiveFrom: body.effectiveFrom,
        effectiveTo: body.effectiveTo,
        history: {
          create: {
            ratePerKwh: new Prisma.Decimal(body.ratePerKwh),
            currency: body.currency,
            effectiveFrom: body.effectiveFrom,
            effectiveTo: body.effectiveTo,
          },
        },
      },
    });
    return jsonOk({ tariff }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
