"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, PageStack } from "@/components/layout/page";
import { useMe, useTariffs } from "@/lib/client/hooks";
import { apiFetch } from "@/lib/client/api";

export default function SettingsPage() {
  const { data, mutate } = useMe();
  const search = useSearchParams();
  const siteId = search.get("siteId") ?? data?.user.sites[0]?.id ?? null;
  const tariffs = useTariffs(siteId);
  const [name, setName] = useState(data?.user.name ?? "");
  const [rate, setRate] = useState("0.18");

  return (
    <PageStack className="lg:grid-cols-2">
      <GlassCard>
        <PageHeader title="Profile" description="Account display settings" />
        <form
          className="mt-4 grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            await apiFetch("/api/v1/auth/me", { method: "PATCH", body: JSON.stringify({ name }) });
            await mutate();
          }}
        >
          <Label htmlFor="name">Display name</Label>
          <Input id="name" value={name || data?.user.name || ""} onChange={(e) => setName(e.target.value)} />
          <p className="break-all text-sm text-muted">{data?.user.email}</p>
          <Button type="submit" className="w-full sm:w-auto">Save</Button>
        </form>
      </GlassCard>
      <GlassCard>
        <PageHeader title="Tariff" description="Site electricity rates" />
        <ul className="mt-3 space-y-2 text-sm">
          {(tariffs.data?.tariffs ?? []).map((tariff) => (
            <li key={tariff.id} className="rounded-xl bg-white/40 px-3 py-2 dark:bg-white/5">
              {tariff.name}: {tariff.ratePerKwh} {tariff.currency}/kWh
            </li>
          ))}
        </ul>
        <form
          className="mt-4 grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!siteId) return;
            await apiFetch(`/api/v1/tariffs?siteId=${siteId}`, {
              method: "POST",
              body: JSON.stringify({
                name: "Standard",
                currency: data?.user.sites.find((s) => s.id === siteId)?.currency ?? "USD",
                ratePerKwh: Number(rate),
                effectiveFrom: new Date().toISOString(),
              }),
            });
            await tariffs.mutate();
          }}
        >
          <Label htmlFor="rate">Rate per kWh</Label>
          <Input id="rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          <Button type="submit" className="w-full sm:w-auto">Add tariff</Button>
        </form>
      </GlassCard>
    </PageStack>
  );
}
