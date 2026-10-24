import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

function verifyPaystackSignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const hash = createHmac("sha512", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Paystack webhook (Nigeria-eligible). Requires PAYSTACK_WEBHOOK_SECRET.
 * Does not invent successful payments without a verified signature.
 */
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
    if (!secret) {
      return jsonError("MISCONFIGURED", "Paystack webhook secret is not configured", 503);
    }
    const rawBody = await request.text();
    const signature = request.headers.get("x-paystack-signature");
    if (!verifyPaystackSignature(rawBody, signature, secret)) {
      return jsonError("UNAUTHENTICATED", "Invalid Paystack signature", 401);
    }
    const event = JSON.parse(rawBody) as {
      event?: string;
      data?: { customer?: { customer_code?: string }; subscription_code?: string; status?: string; metadata?: { organizationId?: string; planTier?: string } };
    };

    await prisma.auditLog.create({
      data: {
        action: "PAYSTACK_WEBHOOK",
        entityType: "Billing",
        metadata: { event: event.event ?? null, status: event.data?.status ?? null },
      },
    });

    if (event.event === "subscription.create" || event.event === "charge.success") {
      const orgId = event.data?.metadata?.organizationId;
      const tier = event.data?.metadata?.planTier;
      if (orgId && tier) {
        const plan = await prisma.subscriptionPlan.findUnique({ where: { tier: tier as never } });
        if (plan) {
          await prisma.subscription.upsert({
            where: { organizationId: orgId },
            update: {
              planId: plan.id,
              tier: plan.tier,
              status: event.data?.status ?? "active",
              paystackCustomerCode: event.data?.customer?.customer_code,
              paystackSubCode: event.data?.subscription_code,
            },
            create: {
              organizationId: orgId,
              planId: plan.id,
              tier: plan.tier,
              status: event.data?.status ?? "active",
              paystackCustomerCode: event.data?.customer?.customer_code,
              paystackSubCode: event.data?.subscription_code,
            },
          });
        }
      }
    }

    return jsonOk({ received: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
