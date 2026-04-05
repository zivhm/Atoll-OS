import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatStatusLabel, normalizeStatusBucket } from "@/lib/models";

export function RuntimeStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const tone = normalizeStatusBucket(status);

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium",
        tone === "running" && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
        tone === "stopped" && "border-border bg-muted text-muted-foreground",
        tone === "provisioning" && "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
        tone === "attention" && "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
        className
      )}
    >
      {formatStatusLabel(status)}
    </Badge>
  );
}
