import { useQuery } from "@tanstack/react-query";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { AtollLogo } from "@/components/AtollLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  MessageSquare,
  Sparkles,
  Plus,
  Settings2,
  Settings,
} from "lucide-react";
import { listAgents, listRuntimeInstances } from "@/lib/api";

export default function AppLayout() {
  const location = useLocation();
  const path = location.pathname;
  const helperRouteMatch = path === "/agents/new" ? null : path.match(/^\/agents\/([^/]+)$/u);
  const helperSettingsRouteMatch =
    path === "/agents/new" ? null : path.match(/^\/agents\/([^/]+)\/settings$/u);
  const isDashboardRoute = path === "/dashboard";
  const isChatRoute = Boolean(helperRouteMatch || helperSettingsRouteMatch);
  const isIdentitiesRoute = path === "/identities";
  const isSettingsRoute = path === "/settings";
  const agentsQuery = useQuery({
    queryKey: ["agents"],
    queryFn: () => listAgents(),
    enabled: true,
  });
  const instancesQuery = useQuery({
    queryKey: ["instances"],
    queryFn: () => listRuntimeInstances(),
    enabled: true,
  });
  const latestInstance = [...(instancesQuery.data ?? [])].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  )[0];
  const firstLiveAgentId = latestInstance?.agentId;
  const firstAgentId = firstLiveAgentId ?? agentsQuery.data?.[0]?.id;
  const activeAgentId = helperRouteMatch?.[1] ?? helperSettingsRouteMatch?.[1];
  const chatHref = activeAgentId
    ? `/agents/${activeAgentId}`
    : firstAgentId
      ? `/agents/${firstAgentId}`
      : "/dashboard";

  const navItems = [
    {
      label: "Dashboard",
      to: "/dashboard",
      icon: LayoutDashboard,
      isActive: isDashboardRoute,
    },
    {
      label: "Chat",
      to: chatHref,
      icon: MessageSquare,
      isActive: isChatRoute,
    },
    {
      label: "Identities",
      to: "/identities",
      icon: Sparkles,
      isActive: isIdentitiesRoute,
    },
    {
      label: "Settings",
      to: "/settings",
      icon: Settings2,
      isActive: isSettingsRoute,
    },
  ];

  return (
    <div className="atoll-shell bg-background">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[96rem] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6 lg:gap-10">
            <Link to="/dashboard" className="flex items-center gap-3 text-foreground">
              <AtollLogo className="h-8" />
              <div className="flex flex-col">
                <span className="text-[1.35rem] font-semibold tracking-[-0.03em] text-foreground">
                  Atoll
                </span>
                <span className="sr-only">Atoll Intelligence</span>
              </div>
            </Link>
            <nav className="hidden items-center gap-2 md:flex">
              {navItems.map(({ label, to, icon: Icon, isActive }) => (
                <NavLink
                  key={label}
                  to={to}
                  aria-current={isActive ? "page" : undefined}
                  className={`atoll-top-nav-item ${isActive ? "is-active" : ""}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Link to="/identities" className="md:hidden">
              <Button size="icon" variant={isIdentitiesRoute ? "secondary" : "ghost"} aria-label="Open identities">
                <Sparkles className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/settings" className="md:hidden">
              <Button size="icon" variant={isSettingsRoute ? "secondary" : "ghost"} aria-label="Open settings">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/agents/new">
              <Button size="sm" className="h-9 gap-2 rounded-2xl px-4 shadow-[0_14px_28px_-20px_hsl(var(--primary)/0.9)]">
                <Plus className="h-3.5 w-3.5" />
                <span>New Helper</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="atoll-page-grid">
        <Outlet />
      </main>
    </div>
  );
}
