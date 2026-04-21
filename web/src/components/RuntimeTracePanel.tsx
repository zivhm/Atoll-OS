import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RuntimeTraceEvent, RuntimeTraceRun, RuntimeTraceRunDetail } from "@/lib/api";
import { formatRelativeDate } from "@/lib/models";
import { cn } from "@/lib/utils";

type RuntimeTracePanelProps = {
  runs: RuntimeTraceRun[];
  selectedTraceId?: string;
  selectedTrace?: RuntimeTraceRunDetail;
  listLoading?: boolean;
  detailLoading?: boolean;
  exportPending?: boolean;
  onSelectTrace: (traceId: string) => void;
  onExportTrace?: (traceId: string) => void;
};

export function RuntimeTracePanel({
  runs,
  selectedTraceId,
  selectedTrace,
  listLoading = false,
  detailLoading = false,
  exportPending = false,
  onSelectTrace,
  onExportTrace
}: RuntimeTracePanelProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Trace runs</p>
          <span className="text-xs text-muted-foreground">{runs.length} total</span>
        </div>
        <ScrollArea className="h-[26rem] rounded-3xl border border-border/70 bg-background/70 p-3">
          <div className="space-y-3">
            {listLoading ? (
              <LoadingState label="Loading trace runs..." />
            ) : runs.length === 0 ? (
              <EmptyState label="No traces recorded yet." />
            ) : (
              runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  data-testid={`trace-run-${run.id}`}
                  className={cn(
                    "w-full rounded-2xl border p-3 text-left transition-colors",
                    selectedTraceId === run.id
                      ? "border-primary/30 bg-primary/10"
                      : "border-border/60 bg-background/80 hover:bg-muted/40"
                  )}
                  onClick={() => onSelectTrace(run.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{run.model}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatRelativeDate(run.startedAt)} · {formatDuration(run.durationMs)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                        run.status === "succeeded"
                          ? "bg-emerald-500/10 text-emerald-700"
                          : run.status === "failed"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-amber-500/10 text-amber-700"
                      )}
                    >
                      {run.status}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <p>Transport: {run.transport}</p>
                    <p>Tool calls: {run.toolCallCount}</p>
                    <p>User msg: {run.userMessageId || "n/a"}</p>
                    <p>Assistant msg: {run.assistantMessageId || run.errorMessageId || "n/a"}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Trace timeline</p>
          {selectedTrace?.run && onExportTrace ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={exportPending}
              onClick={() => onExportTrace(selectedTrace.run.id)}
            >
              {exportPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export trace
            </Button>
          ) : null}
        </div>

        <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
          {detailLoading ? (
            <LoadingState label="Loading trace detail..." />
          ) : !selectedTrace?.run ? (
            <EmptyState label="Select a trace run to inspect its timeline." />
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-foreground">{selectedTrace.run.model}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedTrace.run.runtimeType} · {selectedTrace.run.transport}
                    </p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{formatRelativeDate(selectedTrace.run.startedAt)}</p>
                    <p>{formatDuration(selectedTrace.run.durationMs)}</p>
                  </div>
                </div>
                {selectedTrace.run.failureMessage ? (
                  <p className="mt-3 text-sm text-destructive">{selectedTrace.run.failureMessage}</p>
                ) : null}
              </div>

              <ScrollArea className="h-[22rem] pr-2">
                <div className="space-y-3" data-testid="trace-timeline">
                  {selectedTrace.events.map((event) => (
                    <TraceTimelineItem key={event.id} event={event} />
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TraceTimelineItem({ event }: { event: RuntimeTraceEvent }) {
  return (
    <div
      className="rounded-2xl border border-border/60 bg-background/80 p-3"
      data-testid={`trace-event-${event.sequence}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{formatTraceEventLabel(event.kind)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{event.summary}</p>
        </div>
        <span className="text-xs text-muted-foreground">{formatRelativeDate(event.createdAt)}</span>
      </div>
      {event.data ? (
        <details className="mt-3 rounded-xl border border-border/60 bg-muted/25 p-3">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Event data
          </summary>
          <pre className="mt-3 overflow-auto text-xs leading-6 text-muted-foreground">
            {JSON.stringify(event.data, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-sm text-muted-foreground">{label}</p>;
}

function formatTraceEventLabel(kind: RuntimeTraceEvent["kind"]): string {
  return kind.split("_").join(" ");
}

function formatDuration(durationMs?: number): string {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < 0) {
    return "Duration unavailable";
  }
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }
  if (durationMs < 60_000) {
    return `${(durationMs / 1000).toFixed(1)} s`;
  }
  return `${(durationMs / 60_000).toFixed(1)} min`;
}
