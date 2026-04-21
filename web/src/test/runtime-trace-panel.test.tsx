import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RuntimeTracePanel } from "@/components/RuntimeTracePanel";
import type { RuntimeTraceRun, RuntimeTraceRunDetail } from "@/lib/api";

function buildRun(overrides: Partial<RuntimeTraceRun> = {}): RuntimeTraceRun {
  return {
    id: "trace-2",
    tenantId: "tenant-1",
    agentId: "agent-1",
    instanceId: "instance-1",
    runtimeType: "hermes",
    transport: "openai-chat-completions",
    model: "openai/gpt-5.3-chat",
    status: "succeeded",
    startedAt: "2026-04-20T12:00:00.000Z",
    finishedAt: "2026-04-20T12:00:01.200Z",
    durationMs: 1200,
    toolCallCount: 1,
    userMessageId: "user-msg-1",
    assistantMessageId: "assistant-msg-1",
    ...overrides
  };
}

function buildTraceDetail(): RuntimeTraceRunDetail {
  return {
    run: buildRun(),
    events: [
      {
        id: "event-1",
        runId: "trace-2",
        sequence: 1,
        kind: "request_built",
        createdAt: "2026-04-20T12:00:00.000Z",
        summary: "Built runtime request.",
        data: {
          endpoint: "/v1/chat/completions"
        }
      },
      {
        id: "event-2",
        runId: "trace-2",
        sequence: 2,
        kind: "tool_calls_observed",
        createdAt: "2026-04-20T12:00:00.500Z",
        summary: "Observed tool calls.",
        data: {
          toolCalls: [
            {
              name: "lookup_weather"
            }
          ]
        }
      }
    ]
  };
}

describe("RuntimeTracePanel", () => {
  it("renders runs newest-first and shows selected timeline entries", () => {
    render(
      <RuntimeTracePanel
        runs={[
          buildRun({
            id: "trace-2",
            startedAt: "2026-04-20T12:00:00.000Z"
          }),
          buildRun({
            id: "trace-1",
            startedAt: "2026-04-20T11:00:00.000Z",
            status: "failed",
            failureMessage: "Transport failed."
          })
        ]}
        selectedTraceId="trace-2"
        selectedTrace={buildTraceDetail()}
        onSelectTrace={vi.fn()}
      />
    );

    const runButtons = screen.getAllByRole("button").filter((element) =>
      element.getAttribute("data-testid")?.startsWith("trace-run-")
    );
    expect(runButtons[0]).toHaveAttribute("data-testid", "trace-run-trace-2");
    expect(screen.getByTestId("trace-timeline")).toBeInTheDocument();
    expect(screen.getByTestId("trace-event-1")).toHaveTextContent("Built runtime request.");
    expect(screen.getByTestId("trace-event-2")).toHaveTextContent("Observed tool calls.");
  });

  it("selects a trace and exposes expandable event data", () => {
    const onSelectTrace = vi.fn();
    render(
      <RuntimeTracePanel
        runs={[
          buildRun({
            id: "trace-1",
            startedAt: "2026-04-20T13:00:00.000Z",
            status: "failed",
            errorMessageId: "error-msg-1"
          })
        ]}
        selectedTraceId="trace-1"
        selectedTrace={{
          run: buildRun({
            id: "trace-1",
            status: "failed",
            failureMessage: "Transport failed."
          }),
          events: [
            {
              id: "event-1",
              runId: "trace-1",
              sequence: 1,
              kind: "run_failed",
              createdAt: "2026-04-20T13:00:01.000Z",
              summary: "Runtime chat request failed.",
              data: {
                failureMessage: "Transport failed."
              }
            }
          ]
        }}
        onSelectTrace={onSelectTrace}
      />
    );

    fireEvent.click(screen.getByTestId("trace-run-trace-1"));
    expect(onSelectTrace).toHaveBeenCalledWith("trace-1");
    expect(screen.getByText("Transport failed.")).toBeInTheDocument();
    expect(screen.getByText("Event data")).toBeInTheDocument();
  });
});
