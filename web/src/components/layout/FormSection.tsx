import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function FormSection({
  title,
  description,
  className,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("space-y-3 rounded-xl border border-border/80 bg-muted/15 p-4", className)}>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
