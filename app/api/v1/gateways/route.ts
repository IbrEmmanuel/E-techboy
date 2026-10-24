import { nanoid } from "nanoid";
import { requireUser } from "@/lib/auth/session";
import { requireSiteRole } from "@/lib/auth/access";
import { issueGatewaySecret } from "@/lib/auth/gateway";
import { prisma } from "@/lib/db";
import { entitlementsFor, assertWithinLimit } from "@/lib/billing/entitlements";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { gatewayCreateSchema } from "@/lib/validation/resources";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const siteId = new URL(request.url).searchParams.get("siteId");
    if (!siteId) return jsonError("VALIDATION_ERROR", "siteId is required", 400);
    await requireSiteRole(user, siteId);
    const gateways = await prisma.gateway.findMany({
      where: { siteId },
      select: {
        id: true,
        publicId: true,
        name: true,
        status: true,
        platform: true,
        agentVersion: true,
        lastHeartbeatAt: true,
        credentialRevokedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk({ gateways });
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
    const body = gatewayCreateSchema.parse(await request.json());

    const site = await prisma.site.findUnique({ where: { id: siteId }, include: { organization: { include: { subscription: true } } } });
    const tier = site?.organization?.subscription?.tier ?? "FREE_DEMO";
    const entitlements = entitlementsFor(tier);
    if (!entitlements.gatewayIntegrations) {
      return jsonError("FORBIDDEN", "Gateway integrations are not included in the current plan", 403);
    }
    const count = await prisma.gateway.count({ where: { siteId } });
    try {
      assertWithinLimit(count, entitlements.maxGateways, "Gateways");
    } catch (e) {
      return jsonError("FORBIDDEN", e instanceof Error ? e.message : "Limit reached", 403);
    }

    const { secret, hash } = issueGatewaySecret();
    const publicId = `gw_${nanoid(12)}`;
    const gateway = await prisma.gateway.create({
      data: {
        publicId,
        name: body.name,
        siteId,
        platform: body.platform,
        credentialHash: hash,
        status: "PENDING",
      },
    });
    await prisma.auditLog.create({
      data: { userId: user.id, action: "GATEWAY_REGISTER", entityType: "Gateway", entityId: gateway.id },
    });
    return jsonOk(
      {
        gateway: { id: gateway.id, publicId: gateway.publicId, name: gateway.name, status: gateway.status },
        credential: {
          token: `${gateway.publicId}.${secret}`,
          note: "Store only on the gateway host. Shown once. Authorization: Bearer <token>",
        },
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
