import { requireUser } from "@/lib/auth/session";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { z } from "zod";

const bodySchema = z.object({
  tier: z.enum(["FREE_DEMO", "IOT_STARTER", "PROFESSIONAL", "INDUSTRIAL", "ENTERPRISE"]),
  organizationId: z.string().min(1).optional(),
});

/**
 * Activate / change subscription for an organization the user owns.
 * - Dev / no Paystack key: applies immediately (server-enforced entitlements).
 * - With PAYSTACK_SECRET_KEY: returns a checkout initialization payload (client opens Paystack).
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = bodySchema.parse(await request.json());

    const membership = await prisma.organizationMembership.findFirst({
      where: {
        userId: user.id,
        role: { in: ["OWNER", "ADMIN"] },
        ...(body.organizationId ? { organizationId: body.organizationId } : {}),
      },
      include: { organization: { include: { subscription: true } } },
      orderBy: { createdAt: "asc" },
    });
    if (!membership) {
      return jsonError("FORBIDDEN", "No organization you can bill for", 403);
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { tier: body.tier } });
    if (!plan) return jsonError("NOT_FOUND", "Plan not found", 404);

    const env = getEnv();
    const paystackKey = env.PAYSTACK_SECRET_KEY;

    if (paystackKey && body.tier !== "FREE_DEMO") {
      const amount = Number(plan.priceMonthly);
      const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          amount: Math.round(amount * 100),
          currency: plan.currency || "NGN",
          metadata: {
            organizationId: membership.organizationId,
            tier: body.tier,
            planId: plan.id,
          },
          callback_url: `${env.APP_URL}/billing?paid=1`,
        }),
      });
      const initJson = (await initRes.json()) as {
        status?: boolean;
        message?: string;
        data?: { authorization_url?: string; reference?: string };
      };
      if (!initRes.ok || !initJson.status || !initJson.data?.authorization_url) {
        return jsonError("BILLING_ERROR", initJson.message ?? "Paystack initialize failed", 502);
      }
      return jsonOk({
        mode: "paystack",
        authorizationUrl: initJson.data.authorization_url,
        reference: initJson.data.reference,
        entitlements: entitlementsFor(body.tier),
      });
    }

    const subscription = await prisma.subscription.upsert({
      where: { organizationId: membership.organizationId },
      update: { planId: plan.id, tier: body.tier, status: "active" },
      create: {
        organizationId: membership.organizationId,
        planId: plan.id,
        tier: body.tier,
        status: "active",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "SUBSCRIPTION_ACTIVATE",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: { tier: body.tier, mode: "direct" },
      },
    });

    return jsonOk({
      mode: "direct",
      subscription: {
        id: subscription.id,
        tier: subscription.tier,
        status: subscription.status,
      },
      entitlements: entitlementsFor(body.tier),
      note: paystackKey
        ? "Free plan applied directly."
        : "Applied directly because PAYSTACK_SECRET_KEY is not configured (dev/demo).",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET() {
  try {
    const user = await requireUser();
    const membership = await prisma.organizationMembership.findFirst({
      where: { userId: user.id },
      include: {
        organization: { include: { subscription: { include: { plan: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });
    const tier = membership?.organization.subscription?.tier ?? "FREE_DEMO";
    return jsonOk({
      organization: membership
        ? { id: membership.organizationId, name: membership.organization.name, slug: membership.organization.slug }
        : null,
      subscription: membership?.organization.subscription ?? null,
      entitlements: entitlementsFor(tier),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
