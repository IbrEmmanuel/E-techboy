"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { PageHeader, PageStack, ResponsiveListItem, SplitLayout } from "@/components/layout/page";
import { useAutomationRules, useMe } from "@/lib/client/hooks";
import { apiFetch } from "@/lib/client/api";

export default function AutomationPage() {
  const search = useSearchParams();
  const { data: me } = useMe();
  const siteId = search.get("siteId") ?? me?.user.sites[0]?.id ?? null;
  const rules = useAutomationRules(siteId);
  const [name, setName] = useState("High power advisory");
  const [threshold, setThreshold] = useState("2000");
  const [simResult, setSimResult] = useState<string | null>(null);

  if (rules.error) return <ErrorState message={rules.error.message} onRetry={() => rules.mutate()} />;

  return (
    <PageStack>
      <SplitLayout
        sideFirstOnMobile
        main={
          <GlassCard>
            <PageHeader title="Automation" description={rules.data?.safety} />
            <div className="mt-4 space-y-2">
              {(rules.data?.rules ?? []).length === 0 ? (
                <EmptyState title="No rules yet" body="Create a monitoring or advisory rule." />
              ) : (
                rules.data?.rules.map((rule) => (
                  <ResponsiveListItem key={rule.id}>
                    <div className="min-w-0">
                      <p className="font-medium">{rule.name}</p>
                      <p className="text-xs text-muted">
                        {rule.kind} · {rule.enabled ? "enabled" : "disabled"}
                        {rule.requireApproval ? " · approval required" : ""}
                      </p>
                      {rule.executions?.length ? (
                        <p className="mt-1 text-[11px] text-muted">
                          Last: {rule.executions[0].status} at {new Date(rule.executions[0].startedAt).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={async () => {
                        const result = await apiFetch<{
                          result: { matched: boolean; blockedReason?: string; safetyNote: string };
                        }>(`/api/v1/automation/rules/${rule.id}/simulate`, {
                          method: "POST",
                          body: JSON.stringify({
                            measurements: { active_power: Number(threshold) + 100 },
                            deviceConnected: true,
                            dryRun: true,
                          }),
                        });
                        setSimResult(
                          `Rule ${rule.name}: matched=${result.result.matched}` +
                            (result.result.blockedReason ? ` · ${result.result.blockedReason}` : "") +
                            `\n${result.result.safetyNote}`,
                        );
                        await rules.mutate();
                      }}
                    >
                      Dry-run
                    </Button>
                  </ResponsiveListItem>
                ))
              )}
            </div>
            {simResult ? (
              <pre className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-white/50 p-3 text-xs dark:bg-white/5">
                {simResult}
              </pre>
            ) : null}
          </GlassCard>
        }
        side={
          <GlassCard>
            <h2 className="font-semibold">Rule builder</h2>
            <p className="mt-1 text-xs text-muted">
              active_power above threshold → live alert on ingest (MONITORING, not dry-run)
            </p>
            <form
              className="mt-4 grid gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!siteId) return;
                await apiFetch(`/api/v1/automation/rules?siteId=${siteId}`, {
                  method: "POST",
                  body: JSON.stringify({
                    name,
                    kind: "MONITORING",
                    dryRunDefault: false,
                    requireApproval: false,
                    triggerJson: {
                      type: "measurement_threshold",
                      measurementKey: "active_power",
                      operator: "gt",
                      value: Number(threshold),
                    },
                    conditionsJson: { logic: "and", items: [] },
                    actionsJson: [
                      {
                        type: "create_alert",
                        title: "Power threshold exceeded",
                        message: `Active power exceeded ${threshold} W`,
                        severity: "WARNING",
                      },
                    ],
                  }),
                });
                await rules.mutate();
              }}
            >
              <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Rule name" />
              <Input
                value={threshold}
                inputMode="decimal"
                onChange={(e) => setThreshold(e.target.value)}
                aria-label="Power threshold W"
              />
              <Button type="submit" disabled={!siteId} className="w-full">
                Create monitoring rule
              </Button>
            </form>
          </GlassCard>
        }
      />
    </PageStack>
  );
}
