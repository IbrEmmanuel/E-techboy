"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { PageHeader, PageStack, ResponsiveListItem, SplitLayout } from "@/components/layout/page";
import { useGateways, useMe } from "@/lib/client/hooks";
import { apiFetch } from "@/lib/client/api";

export default function GatewaysPage() {
  const search = useSearchParams();
  const { data: me } = useMe();
  const siteId = search.get("siteId") ?? me?.user.sites[0]?.id ?? null;
  const gateways = useGateways(siteId);
  const [name, setName] = useState("Lab Pi gateway");
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (gateways.error) return <ErrorState message={gateways.error.message} onRetry={() => gateways.mutate()} />;

  return (
    <PageStack>
      <SplitLayout
        sideFirstOnMobile
        main={
          <GlassCard>
            <PageHeader
              title="Gateways"
              description="Outbound edge agents for Modbus, MQTT bridge, and local discovery."
            />
            <div className="mt-4 space-y-2">
              {(gateways.data?.gateways ?? []).length === 0 ? (
                <EmptyState title="No gateways" body="Register a Raspberry Pi or industrial PC agent." />
              ) : (
                gateways.data?.gateways.map((g) => (
                  <ResponsiveListItem key={g.id}>
                    <div className="min-w-0">
                      <p className="font-medium">{g.name}</p>
                      <p className="break-all text-xs text-muted">
                        {g.publicId} · {g.platform} · {g.status}
                        {g.agentVersion ? ` · agent ${g.agentVersion}` : ""}
                      </p>
                      <p className="text-[11px] text-muted">
                        Last heartbeat: {g.lastHeartbeatAt ? new Date(g.lastHeartbeatAt).toLocaleString() : "never"}
                      </p>
                    </div>
                  </ResponsiveListItem>
                ))
              )}
            </div>
          </GlassCard>
        }
        side={
          <GlassCard>
            <h2 className="font-semibold">Register gateway</h2>
            <form
              className="mt-4 grid gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!siteId) return;
                setError(null);
                try {
                  const result = await apiFetch<{ credential: { token: string } }>(`/api/v1/gateways?siteId=${siteId}`, {
                    method: "POST",
                    body: JSON.stringify({ name, platform: "raspberry-pi" }),
                  });
                  setSecret(result.credential.token);
                  await gateways.mutate();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Gateway name" />
              <Button type="submit" disabled={!siteId} className="w-full">
                Create credential
              </Button>
            </form>
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            {secret ? (
              <p className="mt-4 break-all rounded-2xl bg-amber-50 p-3 text-xs dark:bg-amber-400/10">
                Gateway token (copy now): {secret}
              </p>
            ) : null}
            <p className="mt-4 text-xs text-muted">See docs/gateway-raspberry-pi.md for install steps.</p>
          </GlassCard>
        }
      />
    </PageStack>
  );
}
