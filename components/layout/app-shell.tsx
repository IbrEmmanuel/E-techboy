"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, CalendarRange, Menu, X } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAlerts, useMe } from "@/lib/client/hooks";
import { Button } from "@/components/ui/button";
import { ApiClientError, apiFetch } from "@/lib/client/api";
import { MOBILE_MORE_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data, error: meError } = useMe();
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const recoveringAuth = useRef(false);
  const sites = data?.user.sites ?? [];
  const siteId = search.get("siteId") ?? data?.user.preferences?.defaultSiteId ?? sites[0]?.id ?? null;

  useEffect(() => {
    if (!(meError instanceof ApiClientError) || meError.status !== 401 || recoveringAuth.current) return;
    recoveringAuth.current = true;
    void (async () => {
      try {
        await apiFetch("/api/v1/auth/logout", { method: "POST" });
      } catch {
        // Cookie may already be invalid; still send the user to login.
      }
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
    })();
  }, [meError, pathname, router]);

  const [defaultRange] = useState(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 24 * 3600 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
  });
  const from = search.get("from") ?? defaultRange.from;
  const to = search.get("to") ?? defaultRange.to;
  const { data: alerts } = useAlerts(siteId);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams(search.toString());
    if (siteId) params.set("siteId", siteId);
    params.set("from", from);
    params.set("to", to);
    return params;
  }, [search, siteId, from, to]);

  function update(next: Record<string, string>) {
    const params = new URLSearchParams(query);
    Object.entries(next).forEach(([k, v]) => params.set(k, v));
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1440px] gap-3 p-2 pb-[calc(7.25rem+env(safe-area-inset-bottom))] sm:p-3 md:gap-4 md:p-5 md:pb-5">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col gap-3 md:gap-4">
        <header className="glass sticky top-2 z-40 w-full rounded-2xl px-2.5 py-2 sm:rounded-[24px] sm:px-4 sm:py-3">
          <div className="flex w-full items-center gap-1.5 sm:gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Site</span>
              <select
                className="h-10 w-full max-w-full truncate rounded-xl bg-white/50 px-2.5 text-sm dark:bg-white/10 sm:rounded-2xl sm:px-3"
                value={siteId ?? ""}
                onChange={(e) => update({ siteId: e.target.value })}
              >
                {sites.length === 0 ? <option value="">No sites</option> : null}
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 md:hidden"
              aria-label="Toggle date range"
              aria-expanded={rangeOpen}
              onClick={() => {
                setMoreOpen(false);
                setRangeOpen((v) => !v);
              }}
            >
              <CalendarRange className="h-4 w-4" />
            </Button>

            <div className="hidden min-w-0 items-center gap-2 md:flex">
              <label className="flex items-center gap-1 text-xs text-muted">
                From
                <input
                  type="datetime-local"
                  className="h-9 rounded-xl bg-white/50 px-2 text-sm dark:bg-white/10"
                  value={toLocalInput(from)}
                  onChange={(e) => update({ from: new Date(e.target.value).toISOString() })}
                />
              </label>
              <label className="flex items-center gap-1 text-xs text-muted">
                To
                <input
                  type="datetime-local"
                  className="h-9 rounded-xl bg-white/50 px-2 text-sm dark:bg-white/10"
                  value={toLocalInput(to)}
                  onChange={(e) => update({ to: new Date(e.target.value).toISOString() })}
                />
              </label>
            </div>

            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
              <Link
                href="/alerts"
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/30 dark:hover:bg-white/10"
                title={`${alerts?.openCount ?? 0} open alerts`}
              >
                <Bell className="h-4 w-4" />
                {alerts?.openCount ? (
                  <span className="absolute right-1 top-1 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 text-white">
                    {alerts.openCount}
                  </span>
                ) : null}
              </Link>
              <ThemeToggle />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 md:hidden"
                aria-label={moreOpen ? "Close menu" : "Open menu"}
                aria-expanded={moreOpen}
                onClick={() => {
                  setRangeOpen(false);
                  setMoreOpen((v) => !v);
                }}
              >
                {moreOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="hidden md:inline-flex"
                onClick={async () => {
                  await apiFetch("/api/v1/auth/logout", { method: "POST" });
                  router.push("/login");
                }}
              >
                Sign out
              </Button>
            </div>
          </div>

          {rangeOpen ? (
            <div className="mt-3 grid gap-2 border-t border-foreground/10 pt-3 md:hidden">
              <label className="flex flex-col gap-1 text-xs text-muted">
                From
                <input
                  type="datetime-local"
                  className="h-11 w-full rounded-xl bg-white/50 px-3 text-sm dark:bg-white/10"
                  value={toLocalInput(from)}
                  onChange={(e) => update({ from: new Date(e.target.value).toISOString() })}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                To
                <input
                  type="datetime-local"
                  className="h-11 w-full rounded-xl bg-white/50 px-3 text-sm dark:bg-white/10"
                  value={toLocalInput(to)}
                  onChange={(e) => update({ to: new Date(e.target.value).toISOString() })}
                />
              </label>
            </div>
          ) : null}

          {moreOpen ? (
            <div className="mt-3 grid gap-1 border-t border-foreground/10 pt-3 md:hidden">
              {MOBILE_MORE_NAV.map((link) => {
                const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                      active
                        ? "bg-stone-900 text-white dark:bg-teal-400 dark:text-slate-950"
                        : "hover:bg-white/40 dark:hover:bg-white/10",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {link.label}
                  </Link>
                );
              })}
              <Button
                variant="ghost"
                className="min-h-11 justify-start px-3"
                onClick={async () => {
                  await apiFetch("/api/v1/auth/logout", { method: "POST" });
                  router.push("/login");
                }}
              >
                Sign out
              </Button>
            </div>
          ) : null}
        </header>
        <main className="relative z-0 w-full min-w-0 flex-1 overflow-x-hidden pb-2">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
