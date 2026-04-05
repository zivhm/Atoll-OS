import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type IntegrationSettingsCardProps = {
  title: string;
  category: string;
  monogram: string;
  accentBarClassName: string;
  accentBadgeClassName: string;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  summary: string;
  saveLabel?: string;
  saveDisabled?: boolean;
  saveIcon?: ReactNode;
  onSave?: () => void;
  alwaysVisibleContent?: ReactNode;
  children: ReactNode;
};

export function IntegrationSettingsCard({
  title,
  category,
  monogram,
  accentBarClassName,
  accentBadgeClassName,
  enabled,
  onEnabledChange,
  summary,
  saveLabel,
  saveDisabled,
  saveIcon,
  onSave,
  alwaysVisibleContent,
  children,
}: IntegrationSettingsCardProps) {
  return (
    <Card className="overflow-hidden rounded-3xl border border-border/70 bg-card/85 shadow-sm">
      <div className={cn("h-1.5 w-full bg-gradient-to-r", accentBarClassName)} />
      <CardHeader className="gap-5 pb-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-2xl border text-xs font-semibold shadow-sm",
                accentBadgeClassName,
              )}
            >
              {monogram}
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">{category}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
            <Label htmlFor={`${title}-enabled`} className="text-sm font-medium">
              Enabled
            </Label>
            <Switch
              id={`${title}-enabled`}
              aria-label={`${title} enabled`}
              checked={enabled}
              onCheckedChange={onEnabledChange}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {!enabled ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
            {summary}
          </div>
        ) : null}
        {enabled ? <div className="space-y-4">{children}</div> : null}
        {enabled ? alwaysVisibleContent : null}
        {enabled && saveLabel && onSave ? (
          <Button className="w-full gap-2 sm:w-auto" disabled={saveDisabled} onClick={onSave}>
            {saveIcon}
            {saveLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
