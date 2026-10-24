import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading workspace…</div>}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
