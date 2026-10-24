import { cn } from "@/lib/utils";

export function PageStack({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("grid w-full min-w-0 gap-3 sm:gap-4", className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
        {description ? <p className="mt-0.5 text-xs text-muted sm:text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SplitLayout({
  main,
  side,
  sideFirstOnMobile = false,
}: {
  main: React.ReactNode;
  side: React.ReactNode;
  sideFirstOnMobile?: boolean;
}) {
  return (
    <div className="grid w-full min-w-0 gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
      <div className={cn("min-w-0", sideFirstOnMobile && "order-2 lg:order-1")}>{main}</div>
      <div className={cn("min-w-0", sideFirstOnMobile && "order-1 lg:order-2")}>{side}</div>
    </div>
  );
}

export function ResponsiveListItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl bg-white/40 px-3 py-3 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between sm:rounded-2xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MetricGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3 2xl:grid-cols-4">{children}</div>;
}
