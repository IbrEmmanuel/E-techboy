import { requireUser } from "@/lib/auth/session";
import { requireSiteRole } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { handleRouteError, jsonError, jsonOk, parsePagination } from "@/lib/http";
import { alertRuleSchema } from "@/lib/validation/resources";
import { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const siteId = url.searchParams.get("siteId");
    if (!siteId) return jsonError("VALIDATION_ERROR", "siteId is required", 400);
    await requireSiteRole(user, siteId);
    const { take } = parsePagination(url.searchParams);
    const status = url.searchParams.get("status");
    const alerts = await prisma.alert.findMany({
      where: { siteId, ...(status ? { status: status as "OPEN" } : {}) },
      orderBy: { openedAt: "desc" },
      take,
      include: { acknowledgements: true, device: { select: { name: true, publicId: true } } },
    });
    const openCount = await prisma.alert.count({ where: { siteId, status: "OPEN" } });
    return jsonOk({ alerts, openCount });
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
    const body = alertRuleSchema.parse(await request.json());
    const rule = await prisma.alertRule.create({
      data: {
        siteId,
        name: body.name,
        type: body.type,
        severity: body.severity,
        enabled: body.enabled,
        voltageHighV: body.voltageHighV != null ? new Prisma.Decimal(body.voltageHighV) : undefined,
        voltageLowV: body.voltageLowV != null ? new Prisma.Decimal(body.voltageLowV) : undefined,
        currentHighA: body.currentHighA != null ? new Prisma.Decimal(body.currentHighA) : undefined,
        powerHighW: body.powerHighW != null ? new Prisma.Decimal(body.powerHighW) : undefined,
        energyHighKwh: body.energyHighKwh != null ? new Prisma.Decimal(body.energyHighKwh) : undefined,
        hysteresisPercent: new Prisma.Decimal(body.hysteresisPercent),
        sustainSeconds: body.sustainSeconds,
        cooldownSeconds: body.cooldownSeconds,
      },
    });
    return jsonOk({ rule }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
