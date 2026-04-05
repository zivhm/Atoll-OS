import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { ThemeProvider } from "@/hooks/use-theme";
import AppLayout from "@/layouts/AppLayout";

const apiMocks = vi.hoisted(() => ({
  listAgents: vi.fn(),
  listRuntimeInstances: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/api", () => apiMocks);
vi.mock("@/hooks/use-auth", () => authMocks);

const NOW = "2026-04-03T10:00:00.000Z";

function buildQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderLayout(route = "/dashboard") {
  const element: ReactNode = (
    <QueryClientProvider client={buildQueryClient()}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<div>Dashboard route</div>} />
              <Route path="/agents/:agentId" element={<div>Agent detail route</div>} />
              <Route path="/settings" element={<div>Settings route</div>} />
              <Route path="/identities" element={<div>Identities route</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );

  return render(element);
}

describe("app layout chat nav", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    authMocks.useAuth.mockReturnValue({
      session: {
        sub: "local-admin",
        orgId: "local-org",
        authMode: "local",
      },
      loading: false,
      error: "",
      isAuthenticated: true,
      refresh: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("prefers the newest live helper instance over stale agent records", async () => {
    apiMocks.listAgents.mockResolvedValue([
      {
        id: "agent-stale",
        tenantId: "tenant-1",
        name: "Deleted Helper",
        agentType: "general",
        skills: [],
        channel: "custom",
        status: "running",
        createdAt: "2026-04-01T10:00:00.000Z",
      },
      {
        id: "agent-live",
        tenantId: "tenant-1",
        name: "Live Helper",
        agentType: "general",
        skills: [],
        channel: "custom",
        status: "running",
        createdAt: NOW,
      },
    ]);
    apiMocks.listRuntimeInstances.mockResolvedValue([
      {
        id: "instance-live",
        tenantId: "tenant-1",
        agentId: "agent-live",
        runtimeType: "openclaw",
        containerName: "atoll-rt-live",
        volumeName: "atoll_rt_live",
        networkName: "atoll-network",
        gatewayPort: 42617,
        requirePairing: false,
        allowPublicBind: true,
        llmProvider: "openrouter",
        llmModel: "anthropic/claude-sonnet-4.6",
        telegramEnabled: false,
        telegramAllowFrom: [],
        telegramReplyInPrivate: true,
        slackEnabled: false,
        slackAllowedChannelIds: [],
        slackAllowedUserIds: [],
        slackReplyInThread: true,
        discordEnabled: false,
        discordAllowedGuildIds: [],
        discordAllowedChannelIds: [],
        discordReplyInThread: true,
        status: "running",
        createdAt: NOW,
        updatedAt: NOW,
        hasToken: false,
        hasLlmApiKey: true,
        hasTelegramBotToken: false,
        hasSlackBotToken: false,
        hasSlackAppToken: false,
        hasDiscordBotToken: false,
        hasRuntimeSecrets: false,
      },
    ]);

    renderLayout();

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Chat" })).toHaveAttribute(
        "href",
        "/agents/agent-live"
      )
    );
  });
});
