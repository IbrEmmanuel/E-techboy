"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { PageHeader, PageStack, ResponsiveListItem, SplitLayout } from "@/components/layout/page";
import { useDevices, useMe } from "@/lib/client/hooks";
import { apiFetch } from "@/lib/client/api";

export default function DevicesPage() {
  const search = useSearchParams();
  const { data: me } = useMe();
  const siteId = search.get("siteId") ?? me?.user.sites[0]?.id ?? null;
  const devices = useDevices(siteId);
  const [name, setName] = useState("Main meter");
  const [secret, setSecret] = useState<string | null>(null);

  if (devices.error) return <ErrorState message={devices.error.message} onRetry={() => devices.mutate()} />;

  return (
    <PageStack>
      <SplitLayout
        sideFirstOnMobile
        main={
          <GlassCard>
            <PageHeader
              title="Devices"
              description="ESP meters and IoT devices. Tokens shown once."
              actions={
                <Link href="/integrations" className="text-sm text-teal-700 dark:text-teal-300">
                  Connection wizard →
                </Link>
              }
            />
            <div className="mt-4 space-y-2">
              {(devices.data?.devices ?? []).length === 0 ? (
                <EmptyState title="No devices yet" body="Register a device or use the integrations wizard." />
              ) : (
                devices.data?.devices.map((device) => (
                  <ResponsiveListItem key={device.id}>
                    <div className="min-w-0">
                      <Link href={`/devices/${device.id}`} className="font-medium hover:underline">
                        {device.name}
                      </Link>
                      <p className="break-all text-xs text-muted">
                        {device.publicId} · {device.category ?? "ESP32"} · {device.protocol ?? "HTTP"} · {device.status}
                        {device.demoMode ? " · DEMO" : ""}
                      </p>
                    </div>
                    <div className="flex w-full gap-2 sm:w-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 sm:flex-none"
                        onClick={async () => {
                          const result = await apiFetch<{ token: string }>(`/api/v1/devices/${device.id}/rotate`, {
                            method: "POST",
                          });
                          setSecret(result.token);
                          await devices.mutate();
                        }}
                      >
                        Rotate
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        className="flex-1 sm:flex-none"
                        onClick={async () => {
                          await apiFetch(`/api/v1/devices/${device.id}`, { method: "DELETE" });
                          await devices.mutate();
                        }}
                      >
                        Revoke
                      </Button>
                    </div>
                  </ResponsiveListItem>
                ))
              )}
            </div>
            {secret ? (
              <p className="mt-4 break-all rounded-2xl bg-amber-50 p-3 text-xs dark:bg-amber-400/10">
                Device token (copy now): {secret}
              </p>
            ) : null}
          </GlassCard>
        }
        side={
          <GlassCard>
            <h2 className="font-semibold">Quick register (ESP HTTP)</h2>
            <p className="mt-1 text-xs text-muted">Classic ESP32 + PZEM path. Prefer the wizard for industrial protocols.</p>
            <form
              className="mt-4 grid gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!siteId) return;
                const result = await apiFetch<{ credential: { token: string } }>(`/api/v1/devices?siteId=${siteId}`, {
                  method: "POST",
                  body: JSON.stringify({
                    name,
                    sensorModel: "PZEM-004T-V3",
                    category: "ESP32",
                    protocol: "HTTP",
                    demoMode: true,
                  }),
                });
                setSecret(result.credential.token);
                setName("Main meter");
                await devices.mutate();
              }}
            >
              <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Device name" />
              <Button type="submit" disabled={!siteId} className="w-full">
                Create credential
              </Button>
            </form>
          </GlassCard>
        }
      />
    </PageStack>
  );
}
