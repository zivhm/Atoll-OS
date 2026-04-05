import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <Card className={cn("surface-panel", className)} {...props} />;
}

export const PanelHeader = CardHeader;
export const PanelTitle = CardTitle;
export const PanelDescription = CardDescription;
export const PanelContent = CardContent;
export const PanelFooter = CardFooter;

