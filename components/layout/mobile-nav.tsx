"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_PRIMARY_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="glass pointer-events-auto fixed inset-x-2 z-50 flex justify-around rounded-2xl px-1 py-1 shadow-lg md:hidden"
      style={{ bottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      {MOBILE_PRIMARY_NAV.map((link) => {
        const Icon = link.icon;
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10px] leading-tight transition",
              active
                ? "bg-teal-700/15 font-medium text-teal-800 dark:bg-teal-400/20 dark:text-teal-200"
                : "text-muted active:bg-white/30 dark:active:bg-white/10",
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="truncate">{link.shortLabel ?? link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
