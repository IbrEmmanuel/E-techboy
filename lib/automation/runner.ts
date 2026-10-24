import "server-only";

import type { Device } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  dryRunAutomation,
  ruleDefinitionSchema,
  type AutomationContext,
  type RuleDefinition,
} from "@/lib/automation/engine";
import { prisma } from "@/lib/db";
import { asJson } from "@/lib/json";

function parseRule(row: {
  kind: RuleDefinition["kind"];
  requireApproval: boolean;
  triggerJson: unknown;
  conditionsJson: unknown;
  actionsJson: unknown;
}): RuleDefinition {
  return ruleDefinitionSchema.parse({
    kind: row.kind,
    requireApproval: row.requireApproval,
    trigger: row.triggerJson,
    conditions: row.conditionsJson,
    actions: row.actionsJson,
  });
}

async function executeActions(
  device: Device,
  definition: RuleDefinition,
  dryRun: boolean,
): Promise<{ applied: string[]; blockedReason?: string }> {
  const applied: string[] = [];
  if (dryRun) {
    return { applied: definition.actions.map((a) => `dry:${a.type}`) };
  }

  if (definition.kind === "CONTROL" && definition.requireApproval) {
    return {
      applied: [],
      blockedReason: "CONTROL rule requires operator approval before live actions.",
    };
  }

  for (const action of definition.actions) {
    if (action.type === "create_alert" || action.type === "notify_operator") {
      const fingerprint = `auto:${device.id}:${action.title ?? action.type}`;
      const existing = await prisma.alert.findFirst({
        where: {
          deviceId: device.id,
          fingerprint,
          status: { in: ["OPEN", "ACKNOWLEDGED"] },
        },
      });
      if (!existing) {
        await prisma.alert.create({
          data: {
            siteId: device.siteId,
            deviceId: device.id,
            type: "CUSTOM",
            severity: action.severity ?? "WARNING",
            title: action.title ?? "Automation alert",
            message: action.message ?? "Triggered by automation rule",
            fingerprint,
          },
        });
      }
      applied.push(action.type);
      continue;
    }

    if (action.type === "log_event" || action.type === "recommend") {
      await prisma.deviceEvent.create({
        data: {
          deviceId: device.id,
          type: action.type === "recommend" ? "AUTOMATION_RECOMMEND" : "AUTOMATION_LOG",
          payload: {
            title: action.title ?? null,
            message: action.message ?? null,
          },
        },
      });
      applied.push(action.type);
      continue;
    }

    if (action.type === "request_command") {
      if (definition.kind === "CONTROL" && definition.requireApproval) {
        applied.push("request_command:pending_approval");
        continue;
      }
      await prisma.deviceCommand.create({
        data: {
          siteId: device.siteId,
          deviceId: device.id,
          type: action.commandType ?? "REQUEST_STATUS",
          payload: asJson(action.commandPayload ?? {}),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          approvalState: definition.requireApproval ? "PENDING" : "NOT_REQUIRED",
          auditNote: action.message ?? "Created by automation",
        },
      });
      applied.push("request_command");
    }
  }

  return { applied };
}

/**
 * Evaluate enabled site automation rules against a measurement bag after ingest.
 * MONITORING/ADVISORY can run live when dryRunDefault=false.
 * CONTROL with requireApproval stays blocked until approved.
 */
export async function runAutomationAfterIngest(
  device: Device,
  measurements: Record<string, number | boolean | string>,
  opts?: { deviceConnected?: boolean },
) {
  const rules = await prisma.automationRule.findMany({
    where: { siteId: device.siteId, enabled: true },
  });
  if (!rules.length) return { evaluated: 0, matched: 0 };

  const ctx: AutomationContext = {
    measurements,
    deviceConnected: opts?.deviceConnected ?? true,
    now: new Date(),
  };

  let matched = 0;
  for (const row of rules) {
    let definition: RuleDefinition;
    try {
      definition = parseRule(row);
    } catch {
      continue;
    }

    const dryRun = row.dryRunDefault;
    const result = dryRunAutomation(definition, ctx, dryRun);
    if (!result.matched) continue;
    matched += 1;

    const execution = await prisma.automationExecution.create({
      data: {
        ruleId: row.id,
        status: "RUNNING",
        dryRun,
        triggerData: asJson({ measurements, deviceId: device.id }),
      },
    });

    try {
      const executed = await executeActions(device, definition, dryRun || Boolean(result.blockedReason));
      await prisma.automationExecution.update({
        where: { id: execution.id },
        data: {
          status: result.blockedReason || executed.blockedReason ? "SKIPPED" : dryRun ? "SIMULATED" : "SUCCEEDED",
          finishedAt: new Date(),
          resultJson: asJson({
            ...result,
            applied: executed.applied,
            blockedReason: result.blockedReason ?? executed.blockedReason,
          }),
        },
      });
    } catch (error) {
      await prisma.automationExecution.update({
        where: { id: execution.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : "Automation failed",
        },
      });
    }
  }

  return { evaluated: rules.length, matched };
}

/** Keep TypeScript happy when Prisma JSON is used for fingerprints. */
export function decimalOrUndefined(value: number | undefined) {
  return value == null ? undefined : new Prisma.Decimal(value);
}
