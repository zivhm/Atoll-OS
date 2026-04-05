import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Search, Sparkles } from "lucide-react";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageMotion } from "@/components/layout/PageMotion";
import { HelperAvatar } from "@/components/HelperAvatar";
import { RuntimeStatusBadge } from "@/components/RuntimeStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHelperCards } from "@/hooks/use-helper-cards";
import {
  matchesDashboardFilter,
  type DashboardFilter,
} from "@/lib/models";
import { getOnboardingStage, ONBOARDING_COPY } from "@/lib/onboarding";
import { useOnboarding } from "@/hooks/use-onboarding";

const DASHBOARD_FILTER_SEQUENCE: DashboardFilter[] = [
  "all",
  "running",
  "attention",
  "stopped",
  "telegram",
  "pairing",
];

type DashboardCard = ReturnType<typeof useHelperCards>["cards"][number];

export default function Dashboard() {
  const { progress, dismiss } = useOnboarding();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DashboardFilter>("all");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const { cards, loading } = useHelperCards();
  const filteredCards = useMemo(
    () =>
      cards.filter(
        (card) =>
          matchesDashboardFilter(card, filter) &&
          (!deferredSearch || card.searchText.includes(deferredSearch)),
      ),
    [cards, deferredSearch, filter],
  );
  const groupedCards = useMemo(() => {
    const groups = new Map<string, DashboardCard[]>();
    for (const card of filteredCards) {
      const label = card.tenant?.name || "General Workspace";
      const existing = groups.get(label);
      if (existing) {
        existing.push(card);
      } else {
        groups.set(label, [card]);
      }
    }
    return [...groups.entries()].map(([label, items]) => ({ label, items }));
  }, [filteredCards]);

  const onboardingStage = getOnboardingStage({
    progress,
    hasHelpers: cards.length > 0,
    hasSelectedHelper: false,
  });
  const showWelcomePanel = !loading && cards.length === 0 && onboardingStage === "welcome";

  return (
    <PageContainer width="wide" className="space-y-8">
      <PageMotion>
        <PageHeader
          eyebrow=""
          title="Dashboard"
          description="Monitor your helpers from a single view."
          actions={
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-2xl border border-border/70 bg-card/80 px-3 py-2 sm:flex">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) =>
                    startTransition(() => setSearch(event.target.value))
                  }
                  placeholder="Search helpers..."
                  className="h-auto min-w-[12rem] border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                />
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card/80 p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl px-4"
                  onClick={() =>
                    setFilter((current) => {
                      const currentIndex = DASHBOARD_FILTER_SEQUENCE.indexOf(current);
                      return DASHBOARD_FILTER_SEQUENCE[
                        (currentIndex + 1) % DASHBOARD_FILTER_SEQUENCE.length
                      ];
                    })
                  }
                >
                  Filter
                </Button>
              </div>
            </div>
          }
        />
      </PageMotion>

      <div className="space-y-4 sm:hidden">
        <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card/80 px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) =>
              startTransition(() => setSearch(event.target.value))
            }
            placeholder="Search helpers..."
            className="h-auto border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : showWelcomePanel ? (
        <OnboardingWelcomePanel onDismiss={dismiss} />
      ) : filteredCards.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-border/70 px-6 py-12 text-center text-sm text-muted-foreground">
          {cards.length === 0 ? "No helpers yet." : "No helpers match the current search or filter."}
        </div>
      ) : (
        <div className="space-y-10">
          {groupedCards.map((group) => (
            <section key={group.label} className="space-y-5">
              <div className="flex items-center gap-4">
                <h2 className="text-[1.05rem] font-semibold text-foreground">
                  {group.label}
                </h2>
                <div className="atoll-section-rule" />
              </div>
              <div className="atoll-card-grid">
                {group.items.map((card) => (
                  <DashboardHelperSummaryCard key={card.instance.id} card={card} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function DashboardHelperSummaryCard({ card }: { card: DashboardCard }) {
  return (
    <div className="rounded-[28px] border border-border/70 bg-card/90 p-5 shadow-[0_20px_45px_-34px_hsl(var(--foreground)/0.35)] transition-colors hover:border-primary/20">
      <Link to={`/agents/${card.instance.agentId}`} className="block">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <HelperAvatar
              avatar={card.agent?.avatar}
              helperName={card.agent?.name || card.instance.id}
              className="size-12 shrink-0 rounded-2xl"
              fallbackClassName="text-sm"
              imageSize={96}
            />
            <div className="min-w-0">
              <p className="truncate text-2xl font-semibold tracking-[-0.03em] text-foreground">
                {card.agent?.name || card.instance.id}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {card.agent?.roleTitle || card.instance.runtimeType}
              </p>
            </div>
          </div>
          <RuntimeStatusBadge
            status={card.instance.status}
            className="px-2 py-0.5 text-[10px]"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <span>{card.statusLabel}</span>
          <span>•</span>
          <span>{card.instance.llmModel}</span>
        </div>
      </Link>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Button asChild variant="outline" className="w-full rounded-2xl">
          <Link to={`/agents/${card.instance.agentId}`}>Chat</Link>
        </Button>
        <Button asChild variant="outline" className="w-full rounded-2xl">
          <Link to={`/agents/${card.instance.agentId}/settings?tab=shared-files`}>
            Files
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full rounded-2xl">
          <Link to={`/agents/${card.instance.agentId}/settings?tab=runtime`}>
            Settings
          </Link>
        </Button>
      </div>
    </div>
  );
}

function OnboardingWelcomePanel({
  onDismiss,
}: {
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-primary/80">
            {ONBOARDING_COPY.welcome.timeToComplete}
          </p>
          <p className="text-xl font-semibold text-foreground">
            {ONBOARDING_COPY.welcome.title}
          </p>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {ONBOARDING_COPY.welcome.description}
          </p>
          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3">
              1. Name your helper
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3">
              2. Keep the recommended setup
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3">
              3. Send a first message
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/agents/new?mode=onboarding">
            <Button>Create my first helper</Button>
          </Link>
          <Button variant="ghost" onClick={onDismiss}>
            Maybe later
          </Button>
        </div>
      </div>
    </div>
  );
}
