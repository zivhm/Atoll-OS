import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function LabeledField({
  label,
  children,
  className,
  labelClassName,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <div className={className}>
      <Label className={cn("mb-2 block text-sm font-medium", labelClassName)}>
        {label}
      </Label>
      {children}
    </div>
  );
}
