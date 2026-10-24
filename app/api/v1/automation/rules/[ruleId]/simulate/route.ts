import { requireUser } from "@/lib/auth/session";
import { requireSiteRole } from "@/lib/auth/access";
import { dryRunAutomation, ruleDefinitionSchema } from "@/lib/automation/engine";
import { prisma } from "@/lib/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { asJson } from "@/lib/json";
import { automationSimulateSchema } from "@/lib/validation/resources";

export async function POST(request: Request, context: { params: Promise<{ ruleId: string }> }) {
  try {
    const user = await requireUser();
    const { ruleId } = await context.params;
    const body = automationSimulateSchema.parse(await request.json());
    const rule = await prisma.automationRule.findUnique({ where: { id: ruleId } });
    if (!rule) return jsonError("NOT_FOUND", "Rule not found", 404);
    await requireSiteRole(user, rule.siteId, "OPERATOR");

    const definition = ruleDefinitionSchema.parse({
      kind: rule.kind,
      trigger: rule.triggerJson,
      conditions: rule.conditionsJson,
      actions: rule.actionsJson,
      requireApproval: rule.requireApproval,
    });

    const result = dryRunAutomation(definition, {
      measurements: body.measurements,
      deviceConnected: body.deviceConnected,
    }, body.dryRun);

    const execution = await prisma.automationExecution.create({
      data: {
        ruleId: rule.id,
        status: result.matched ? (body.dryRun ? "SIMULATED" : "PENDING") : "SKIPPED",
        dryRun: body.dryRun,
        triggerData: asJson(body),
        resultJson: asJson(result),
        finishedAt: new Date(),
      },
    });

    return jsonOk({ result, executionId: execution.id });
  } catch (error) {
    return handleRouteError(error);
  }
}
