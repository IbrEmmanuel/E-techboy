import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-white/70 bg-white/50 px-3 text-base outline-none ring-accent placeholder:text-muted focus-visible:ring-2 dark:border-white/10 dark:bg-white/5 sm:h-10 sm:rounded-2xl sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}
