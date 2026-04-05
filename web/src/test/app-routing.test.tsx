import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "@/App";

vi.mock("@/components/ui/toaster", () => ({
  Toaster: () => null,
}));

vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => null,
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/use-theme", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/use-auth", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ProtectedRoute", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/layouts/AppLayout", async () => {
  const reactRouterDom = await import("react-router-dom");
  return {
    default: () => <reactRouterDom.Outlet />,
  };
});

vi.mock("@/pages/Dashboard", () => ({
  default: () => <div>Dashboard route</div>,
}));

vi.mock("@/pages/AgentChat", () => ({
  default: () => <div>Agent route</div>,
}));

vi.mock("@/pages/AgentSetup", () => ({
  default: () => <div>Agent setup route</div>,
}));

vi.mock("@/pages/AgentSettings", () => ({
  default: () => <div>Agent settings route</div>,
}));

vi.mock("@/pages/AccountSettings", () => ({
  default: () => <div>Account settings route</div>,
}));

vi.mock("@/pages/DevDocs", () => ({
  default: () => <div>Dev docs route</div>,
}));

vi.mock("@/pages/NotFound", () => ({
  default: () => <div>Not found route</div>,
}));

describe("app routing", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("redirects the product root path to the dashboard", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard route")).toBeInTheDocument();
    });

    expect(window.location.pathname).toBe("/dashboard");
  });
});
