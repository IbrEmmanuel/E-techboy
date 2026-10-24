"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { PageHeader, PageStack, ResponsiveListItem, SplitLayout } from "@/components/layout/page";
import { useAlerts, useMe } from "@/lib/client/hooks";
import { apiFetch } from "@/lib/client/api";

const RULE_TYPES = [
  { id: "OVERVOLTAGE", label: "Overvoltage", field: "voltageHighV", placeholder: "250" },
  { id: "UNDERVOLTAGE", label: "Undervoltage", field: "voltageLowV", placeholder: "200" },
  { id: "OVERCURRENT", label: "Overcurrent", field: "currentHighA", placeholder: "10" },
  { id: "EXCESSIVE_POWER", label: "Excessive power", field: "powerHighW", placeholder: "3000" },
] as const;

export default function AlertsPage() {
  const search = useSearchParams();
  const { data: me } = useMe();
  const siteId = search.get("siteId") ?? me?.user.sites[0]?.id ?? null;
  const alerts = useAlerts(siteId);
  const [ruleType, setRuleType] = useState<(typeof RULE_TYPES)[number]["id"]>("OVERVOLTAGE");
  const [ruleName, setRuleName] = useState("Custom threshold");
  const [threshold, setThreshold] = useState("250");
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);

  if (alerts.error) return <ErrorState message={alerts.error.message} onRetry={() => alerts.mutate()} />;

  const selected = RULE_TYPES.find((r) => r.id === ruleType) ?? RULE_TYPES[0];

  return (
    <PageStack>
      <SplitLayout
        sideFirstOnMobile
        main={
          <GlassCard>
            <PageHeader
              title="Alerts"
              description={`${alerts.data?.openCount ?? 0} open · hysteresis and cooldowns applied during ingestion`}
            />
            <div className="mt-4 space-y-2">
              {(alerts.data?.alerts ?? []).length === 0 ? (
                <EmptyState title="Quiet site" body="No stored alerts for this site." />
              ) : (
                alerts.data?.alerts.map((alert) => (
                  <ResponsiveListItem key={alert.id}>
                    <div className="min-w-0">
                      <p className="font-medium">
                        {alert.title} · {alert.severity} · {alert.status}
                      </p>
                      <p className="text-xs text-muted">{alert.message}</p>
                    </div>
                    {alert.status === "OPEN" ? (
                      <Button
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={async () => {
                          await apiFetch(`/api/v1/alerts/${alert.id}/ack`, { method: "POST", body: "{}" });
                          await alerts.mutate();
                        }}
                      >
                        Acknowledge
                      </Button>
                    ) : null}
                  </ResponsiveListItem>
                ))
              )}
            </div>
          </GlassCard>
        }
        side={
          <GlassCard>
            <h2 className="font-semibold">Create alert rule</h2>
            <p className="mt-1 text-xs text-muted">Rules evaluate on every telemetry ingest for this site.</p>
            <form
              className="mt-4 grid gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!siteId) return;
                setFormError(null);
                setFormOk(null);
                try {
                  const value = Number(threshold);
                  const body: Record<string, unknown> = {
                    name: ruleName,
                    type: ruleType,
                    severity: "WARNING",
                    enabled: true,
                    hysteresisPercent: 2,
                    sustainSeconds: 0,
                    cooldownSeconds: 60,
                    [selected.field]: value,
                  };
                  await apiFetch(`/api/v1/alerts?siteId=${siteId}`, {
                    method: "POST",
                    body: JSON.stringify(body),
                  });
                  setFormOk(`Rule “${ruleName}” saved`);
                  await alerts.mutate();
                } catch (err) {
                  setFormError(err instanceof Error ? err.message : "Failed to create rule");
                }
              }}
            >
              <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} aria-label="Rule name" />
              <select
                className="h-10 w-full rounded-xl border bg-transparent px-3 text-sm"
                value={ruleType}
                onChange={(e) => {
                  const next = e.target.value as (typeof RULE_TYPES)[number]["id"];
                  setRuleType(next);
                  const meta = RULE_TYPES.find((r) => r.id === next);
                  if (meta) setThreshold(meta.placeholder);
                }}
                aria-label="Rule type"
              >
                {RULE_TYPES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <Input
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                aria-label="Threshold"
                placeholder={selected.placeholder}
              />
              <Button type="submit" disabled={!siteId} className="w-full">
                Save rule
              </Button>
              {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
              {formOk ? <p className="text-sm text-teal-700 dark:text-teal-300">{formOk}</p> : null}
            </form>
          </GlassCard>
        }
      />
    </PageStack>
  );
}
