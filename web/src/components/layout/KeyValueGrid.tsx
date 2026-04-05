import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

const GRID_CLASS: Record<KeyValueGridColumns, string> = {
  two: "sm:grid-cols-2",
  three: "sm:grid-cols-2 lg:grid-cols-3",
  four: "sm:grid-cols-2 xl:grid-cols-4",
};

type KeyValueGridColumns = "two" | "three" | "four";

export function KeyValueGrid({
  columns = "two",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { columns?: KeyValueGridColumns }) {
  return <div className={cn("grid gap-3", GRID_CLASS[columns], className)} {...props} />;
}

export function KeyValueItem({
  label,
  value,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border/80 bg-muted/25 p-3.5", className)}>
      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
      <p className="mt-1 break-all text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
