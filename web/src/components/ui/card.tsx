import * as React from "react";

import { cn } from "@/lib/utils";

function createCardSection(displayName: string, defaultClassName: string) {
  const Component = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
  >(({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(defaultClassName, className)}
      {...props}
    />
  ));
  Component.displayName = displayName;
  return Component;
}

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("rounded-[16px] border border-border/70 bg-card text-card-foreground shadow-sm", className)}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = createCardSection("CardHeader", "flex flex-col space-y-1.5 p-5");

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-xl font-semibold leading-none tracking-[-0.02em]", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = createCardSection("CardContent", "p-5 pt-0");

const CardFooter = createCardSection("CardFooter", "flex items-center p-5 pt-0");

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
