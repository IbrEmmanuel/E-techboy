"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/glass-card";
import { Button } from "@/components/ui/button";
import { PageHeader, PageStack } from "@/components/layout/page";
import { useAnalytics, useMe } from "@/lib/client/hooks";

export default function ReportsPage() {
  const search = useSearchParams();
  const { data: me } = useMe();
  const siteId = search.get("siteId") ?? me?.user.sites[0]?.id ?? null;
  const [defaultRange] = useState(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 86400000);
    return { from: from.toISOString(), to: to.toISOString() };
  });
  const from = search.get("from") ?? defaultRange.from;
  const to = search.get("to") ?? defaultRange.to;
  const analytics = useAnalytics(siteId, from, to);

  return (
    <PageStack>
      <GlassCard>
        <PageHeader
          title="Reports"
          description="CSV export uses the same analytics engine as the charts."
          actions={
            <Button asChild disabled={!siteId} className="w-full sm:w-auto">
              <a
                href={
                  siteId
                    ? `/api/v1/reports?siteId=${siteId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&format=csv`
                    : "#"
                }
              >
                Download CSV
              </a>
            </Button>
          }
        />
        <pre className="mt-5 max-h-[50vh] overflow-auto rounded-xl bg-white/40 p-3 text-[11px] leading-relaxed dark:bg-white/5 sm:mt-6 sm:rounded-2xl sm:p-4 sm:text-xs">
          {JSON.stringify(analytics.data?.analytics.totals ?? { loading: true }, null, 2)}
        </pre>
      </GlassCard>
    </PageStack>
  );
}
