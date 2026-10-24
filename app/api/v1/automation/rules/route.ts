import { requireUser } from "@/lib/auth/session";
import { requireSiteRole } from "@/lib/auth/access";
import { ruleDefinitionSchema } from "@/lib/automation/engine";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { prisma } from "@/lib/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { asJson, asJsonOrUndefined } from "@/lib/json";
import { automationRuleCreateSchema } from "@/lib/validation/resources";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const siteId = new URL(request.url).searchParams.get("siteId");
    if (!siteId) return jsonError("VALIDATION_ERROR", "siteId is required", 400);
    await requireSiteRole(user, siteId);
    const rules = await prisma.automationRule.findMany({
      where: { siteId },
      include: { executions: { take: 5, orderBy: { startedAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk({
      rules,
      safety:
        "Automation here is monitoring/advisory by default. CONTROL is not a replacement for PLC scan cycles, interlocks, or emergency stops.",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const siteId = new URL(request.url).searchParams.get("siteId");
    if (!siteId) return jsonError("VALIDATION_ERROR", "siteId is required", 400);
    await requireSiteRole(user, siteId, "OPERATOR");
    const body = automationRuleCreateSchema.parse(await request.json());

    if (body.kind === "CONTROL") {
      const site = await prisma.site.findUnique({
        where: { id: siteId },
        include: { organization: { include: { subscription: true } } },
      });
      const entitlements = entitlementsFor(site?.organization?.subscription?.tier ?? "FREE_DEMO");
      if (!entitlements.automationControl) {
        return jsonError("FORBIDDEN", "CONTROL automation requires Professional or higher", 403);
      }
    }

    const definition = ruleDefinitionSchema.parse({
      kind: body.kind,
      trigger: body.triggerJson,
      conditions: body.conditionsJson,
      actions: body.actionsJson,
      requireApproval: body.requireApproval,
    });

    const rule = await prisma.automationRule.create({
      data: {
        siteId,
        name: body.name,
        kind: body.kind,
        enabled: body.enabled,
        dryRunDefault: body.dryRunDefault,
        requireApproval: body.requireApproval || body.kind === "CONTROL",
        triggerJson: asJson(definition.trigger),
        conditionsJson: asJson(definition.conditions),
        actionsJson: asJson(definition.actions),
        scheduleCron: body.scheduleCron,
        retryPolicyJson: asJsonOrUndefined(body.retryPolicyJson),
      },
    });

    await prisma.auditLog.create({
      data: { userId: user.id, action: "AUTOMATION_RULE_CREATE", entityType: "AutomationRule", entityId: rule.id },
    });

    return jsonOk({ rule }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
