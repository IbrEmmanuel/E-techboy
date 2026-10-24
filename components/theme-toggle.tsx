"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      <span className="relative inline-flex h-4 w-4 items-center justify-center">
        <Sun className="h-4 w-4 scale-100 transition-transform dark:scale-0" />
        <Moon className="absolute h-4 w-4 scale-0 transition-transform dark:scale-100" />
      </span>
    </Button>
  );
}
