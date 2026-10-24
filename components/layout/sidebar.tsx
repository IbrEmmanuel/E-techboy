"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity } from "lucide-react";
import { APP_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="glass sticky top-5 hidden h-[calc(100dvh-2.5rem)] w-64 shrink-0 flex-col rounded-[28px] p-4 md:flex">
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-700 text-white">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted">EnergyMonitor</p>
          <p className="font-semibold tracking-tight">Universal IoT</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
        {APP_NAV.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition",
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
      </nav>
    </aside>
  );
}
