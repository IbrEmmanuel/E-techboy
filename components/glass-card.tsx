import { cn } from "@/lib/utils";

export function GlassCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <section className={cn("glass rounded-2xl p-3.5 sm:rounded-3xl sm:p-5", className)}>{children}</section>;
}
