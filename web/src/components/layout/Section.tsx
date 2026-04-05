import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Section({
  title,
  description,
  actions,
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("stack-section", className)}>
      {title || description || actions ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            {title ? <h2 className="text-base font-semibold tracking-tight">{title}</h2> : null}
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

