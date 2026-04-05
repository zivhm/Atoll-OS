import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function ActionBar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap gap-2", className)} {...props} />;
}

export function ActionGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-muted/20 px-2.5 py-2",
        className
      )}
      {...props}
    />
  );
}
