import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const WIDTH_CLASS: Record<PageContainerWidth, string> = {
  narrow: "max-w-4xl",
  content: "max-w-6xl",
  wide: "max-w-[90rem]",
  full: "max-w-[96rem]",
};

export type PageContainerWidth = "narrow" | "content" | "wide" | "full";

export function PageContainer({
  className,
  width = "wide",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  width?: PageContainerWidth;
}) {
  return <div className={cn("page-container", WIDTH_CLASS[width], className)} {...props} />;
}
