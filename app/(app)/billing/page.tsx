"use client";

import { useState } from "react";
import useSWR from "swr";
import { GlassCard } from "@/components/glass-card";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/empty-state";
import { PageHeader, PageStack } from "@/components/layout/page";
import { apiFetch } from "@/lib/client/api";
import { useBillingPlans } from "@/lib/client/hooks";

type BillingStatus = {
  organization: { id: string; name: string; slug: string } | null;
  subscription: { tier: string; status: string } | null;
  entitlements: {
    tier: string;
    maxDevices: number;
    maxSites: number;
    maxGateways: number;
    realDevices: boolean;
    industrialProtocols: boolean;
    automationControl: boolean;
  };
};

export default function BillingPage() {
  const plans = useBillingPlans();
  const status = useSWR<BillingStatus>("/api/v1/billing/activate", (url: string) => apiFetch<BillingStatus>(url), {
    revalidateOnFocus: true,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (plans.error) return <ErrorState message={plans.error.message} onRetry={() => plans.mutate()} />;

  const currentTier = status.data?.subscription?.tier ?? status.data?.entitlements?.tier ?? "FREE_DEMO";

  return (
    <PageStack>
      <GlassCard>
        <PageHeader
          title="Subscriptions"
          description={
            status.data?.organization
              ? `${status.data.organization.name} · current ${currentTier}`
              : plans.data?.note
          }
        />
        {message ? <p className="mt-3 text-sm text-teal-700 dark:text-teal-300">{message}</p> : null}
      </GlassCard>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(plans.data?.plans ?? []).map((plan) => {
          const active = plan.tier === currentTier;
          return (
            <GlassCard key={plan.tier} className="min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold">{plan.name}</h2>
                {active ? (
                  <span className="rounded-full bg-teal-700/15 px-2 py-0.5 text-[10px] uppercase text-teal-800 dark:text-teal-200">
                    Current
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted">{plan.tier}</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                <li>{plan.maxDevices} devices</li>
                <li>{plan.maxSites} sites</li>
                <li>{plan.maxGateways} gateways</li>
                <li>{plan.historyDays} days history</li>
                <li>{plan.realDevices ? "Real devices" : "Demo / simulated only"}</li>
                <li>{plan.industrialProtocols ? "Industrial protocols" : "Core IoT protocols"}</li>
              </ul>
              <p className="mt-4 text-xs text-muted">{plan.priceNote}</p>
              <Button
                className="mt-4 w-full"
                variant={active ? "outline" : "default"}
                disabled={active || busy === plan.tier || !status.data?.organization}
                onClick={async () => {
                  setBusy(plan.tier);
                  setMessage(null);
                  try {
                    const result = await apiFetch<{
                      mode: string;
                      authorizationUrl?: string;
                      note?: string;
                      subscription?: { tier: string };
                    }>("/api/v1/billing/activate", {
                      method: "POST",
                      body: JSON.stringify({ tier: plan.tier }),
                    });
                    if (result.mode === "paystack" && result.authorizationUrl) {
                      window.location.href = result.authorizationUrl;
                      return;
                    }
                    setMessage(result.note ?? `Activated ${result.subscription?.tier ?? plan.tier}`);
                    await Promise.all([status.mutate(), plans.mutate()]);
                  } catch (e) {
                    setMessage(e instanceof Error ? e.message : "Activation failed");
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {active ? "Active" : busy === plan.tier ? "Applying…" : "Activate"}
              </Button>
            </GlassCard>
          );
        })}
      </div>
    </PageStack>
  );
}
