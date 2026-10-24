import { z } from "zod";

/**
 * Monitoring / advisory / control automation evaluator.
 * Cloud rules are NOT a replacement for PLC scan cycles, interlocks, or e-stops.
 */

export const triggerSchema = z.object({
  type: z.enum([
    "measurement_threshold",
    "device_disconnect",
    "schedule",
    "alert_opened",
    "manual",
  ]),
  deviceId: z.string().optional(),
  measurementKey: z.string().optional(),
  operator: z.enum(["gt", "gte", "lt", "lte", "eq", "neq"]).optional(),
  value: z.number().optional(),
  cron: z.string().optional(),
});

export const conditionSchema = z.object({
  logic: z.enum(["and", "or"]).default("and"),
  items: z
    .array(
      z.object({
        measurementKey: z.string(),
        operator: z.enum(["gt", "gte", "lt", "lte", "eq", "neq"]),
        value: z.union([z.number(), z.boolean(), z.string()]),
      }),
    )
    .max(32),
});

export const actionSchema = z.object({
  type: z.enum([
    "create_alert",
    "notify_operator",
    "log_event",
    "recommend",
    "request_command",
  ]),
  title: z.string().max(200).optional(),
  message: z.string().max(2000).optional(),
  commandType: z.string().max(64).optional(),
  commandPayload: z.record(z.string(), z.unknown()).optional(),
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]).optional(),
});

export const ruleDefinitionSchema = z.object({
  kind: z.enum(["MONITORING", "ADVISORY", "CONTROL"]).default("MONITORING"),
  trigger: triggerSchema,
  conditions: conditionSchema.default({ logic: "and", items: [] }),
  actions: z.array(actionSchema).min(1).max(16),
  requireApproval: z.boolean().default(false),
});

export type RuleDefinition = z.infer<typeof ruleDefinitionSchema>;
export type AutomationContext = {
  measurements: Record<string, number | boolean | string>;
  deviceConnected?: boolean;
  now?: Date;
};

function compare(left: number | boolean | string, op: string, right: number | boolean | string): boolean {
  switch (op) {
    case "gt":
      return Number(left) > Number(right);
    case "gte":
      return Number(left) >= Number(right);
    case "lt":
      return Number(left) < Number(right);
    case "lte":
      return Number(left) <= Number(right);
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    default:
      return false;
  }
}

export function evaluateConditions(
  conditions: z.infer<typeof conditionSchema>,
  measurements: Record<string, number | boolean | string>,
): boolean {
  if (!conditions.items.length) return true;
  const results = conditions.items.map((item) => {
    if (!(item.measurementKey in measurements)) return false;
    return compare(measurements[item.measurementKey], item.operator, item.value);
  });
  return conditions.logic === "or" ? results.some(Boolean) : results.every(Boolean);
}

export function evaluateTrigger(trigger: z.infer<typeof triggerSchema>, ctx: AutomationContext): boolean {
  switch (trigger.type) {
    case "manual":
    case "schedule":
      return true;
    case "device_disconnect":
      return ctx.deviceConnected === false;
    case "measurement_threshold": {
      if (!trigger.measurementKey || !trigger.operator || trigger.value === undefined) return false;
      const current = ctx.measurements[trigger.measurementKey];
      if (current === undefined) return false;
      return compare(current, trigger.operator, trigger.value);
    }
    case "alert_opened":
      return true;
    default:
      return false;
  }
}

export type DryRunResult = {
  matched: boolean;
  kind: RuleDefinition["kind"];
  dryRun: boolean;
  actions: z.infer<typeof actionSchema>[];
  blockedReason?: string;
  safetyNote: string;
};

export function dryRunAutomation(rule: RuleDefinition, ctx: AutomationContext, dryRun = true): DryRunResult {
  const safetyNote =
    "Cloud automation is monitoring/advisory by default. CONTROL actions require approval, allowlists, and must never bypass local safety interlocks or e-stops.";
  const matched = evaluateTrigger(rule.trigger, ctx) && evaluateConditions(rule.conditions, ctx.measurements);
  if (!matched) {
    return { matched: false, kind: rule.kind, dryRun, actions: [], safetyNote };
  }
  if (rule.kind === "CONTROL" && rule.requireApproval && dryRun) {
    return {
      matched: true,
      kind: rule.kind,
      dryRun: true,
      actions: rule.actions,
      blockedReason: "CONTROL rule requires approval; dry-run only — no command submitted.",
      safetyNote,
    };
  }
  if (rule.kind === "CONTROL" && !dryRun) {
    const unsafe = rule.actions.filter((a) => a.type === "request_command");
    if (unsafe.length && rule.requireApproval) {
      return {
        matched: true,
        kind: rule.kind,
        dryRun: false,
        actions: rule.actions,
        blockedReason: "Pending operator approval before command request.",
        safetyNote,
      };
    }
  }
  return { matched: true, kind: rule.kind, dryRun, actions: rule.actions, safetyNote };
}
