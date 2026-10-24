import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-stone-900 text-white hover:bg-stone-800 dark:bg-teal-400 dark:text-slate-950",
        ghost: "hover:bg-white/40 dark:hover:bg-white/10",
        outline: "border border-white/60 bg-white/30 hover:bg-white/50 dark:border-white/10",
        danger: "bg-red-600 text-white hover:bg-red-500",
      },
      size: {
        default: "h-11 min-h-11 px-4 sm:h-10",
        sm: "h-10 min-h-10 px-3 text-xs sm:h-8",
        icon: "h-11 w-11 sm:h-10 sm:w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
