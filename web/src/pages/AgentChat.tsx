import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, Send, Settings2 } from "lucide-react";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageMotion } from "@/components/layout/PageMotion";
import { HelperAvatar } from "@/components/HelperAvatar";
import { RuntimeStatusBadge } from "@/components/RuntimeStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useHelperCards } from "@/hooks/use-helper-cards";
import { useOnboarding } from "@/hooks/use-onboarding";
import {
  getRuntimeChatErrorMessage,
  listRuntimeCatalog,
  listRuntimeChatMessages,
  sendRuntimeChat,
  type RuntimeChatMessage,
} from "@/lib/api";
import {
  formatRelativeDate,
  getVisibleRuntimeCatalog,
  resolvePreferredRuntime,
} from "@/lib/models";
import {
  getOnboardingStage,
  ONBOARDING_COPY,
  ONBOARDING_PROMPTS,
} from "@/lib/onboarding";
import { cn } from "@/lib/utils";

const EMPTY_CHAT_MESSAGES: RuntimeChatMessage[] = [];

export default function AgentChat() {
  const { agentId = "" } = useParams();
  const queryClient = useQueryClient();
  const { progress, markFirstChatCompleted } = useOnboarding();
  const [searchValue, setSearchValue] = useState("");
  const deferredSearch = useDeferredValue(searchValue.trim().toLowerCase());
  const [chatDraft, setChatDraft] = useState("");
  const [chatError, setChatError] = useState("");

  const { cards: helperCards, loading: helperCardsLoading } = useHelperCards();
  const runtimeCatalogQuery = useQuery({
    queryKey: ["runtime-catalog"],
    queryFn: listRuntimeCatalog,
  });
  const filteredCards = useMemo(() => {
    if (!deferredSearch) {
      return helperCards;
    }
    return helperCards.filter((card) => {
      const preview = [
        card.agent?.presetSummary,
        card.agent?.roleTitle,
        card.statusLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return `${card.searchText} ${preview}`.includes(deferredSearch);
    });
  }, [deferredSearch, helperCards]);

  const selectedCard = useMemo(
    () => helperCards.find((card) => card.instance.agentId === agentId),
    [agentId, helperCards],
  );
  const selectedAgent = selectedCard?.agent;
  const selectedInstance = selectedCard?.instance;
  const selectedTenant = selectedCard?.tenant;
  const selectedRuntime = selectedInstance
    ? resolvePreferredRuntime(
        getVisibleRuntimeCatalog(runtimeCatalogQuery.data ?? []),
        selectedInstance.runtimeType,
      )
    : undefined;
  const instanceId = selectedInstance?.id;
  const chatQuery = useQuery({
    queryKey: ["runtime-chat", instanceId],
    queryFn: () => listRuntimeChatMessages(instanceId!, 100),
    enabled: Boolean(instanceId),
  });

  const loading = helperCardsLoading || runtimeCatalogQuery.isLoading;
  const chatMessages = chatQuery.data ?? EMPTY_CHAT_MESSAGES;
  const onboardingStage = getOnboardingStage({
    progress,
    hasHelpers: helperCards.length > 0,
    hasSelectedHelper: Boolean(selectedAgent),
  });
  const chatBlockState = getAgentChatBlockState(selectedInstance, selectedRuntime);

  useEffect(() => {
    if (
      !selectedInstance ||
      !progress.helperCreated ||
      progress.firstChatCompleted ||
      !chatMessages.some((message) => message.role === "assistant")
    ) {
      return;
    }

    markFirstChatCompleted();
  }, [
    chatMessages,
    markFirstChatCompleted,
    progress.firstChatCompleted,
    progress.helperCreated,
    selectedInstance,
  ]);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!selectedInstance) {
        throw new Error("No runtime instance found");
      }
      return sendRuntimeChat(selectedInstance.id, { message });
    },
    onMutate: async (message) => {
      if (!selectedInstance) {
        return;
      }
      setChatError("");
      const queryKey = ["runtime-chat", selectedInstance.id] as const;
      await queryClient.cancelQueries({ queryKey });
      const previousMessages =
        queryClient.getQueryData<RuntimeChatMessage[]>(queryKey) ?? EMPTY_CHAT_MESSAGES;
      const optimisticMessage: RuntimeChatMessage = {
        id: `optimistic-${Date.now()}`,
        instanceId: selectedInstance.id,
        role: "user",
        content: message,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<RuntimeChatMessage[]>(
        queryKey,
        mergeChatMessages(previousMessages, [optimisticMessage]),
      );
      setChatDraft("");
      return { previousMessages };
    },
    onError: (error, _message, context) => {
      if (selectedInstance && context?.previousMessages) {
        queryClient.setQueryData(
          ["runtime-chat", selectedInstance.id],
          context.previousMessages,
        );
      }
      setChatError(getRuntimeChatErrorMessage(error, "Could not send the message"));
    },
    onSuccess: (payload) => {
      if (!selectedInstance) {
        return;
      }
      queryClient.setQueryData<RuntimeChatMessage[]>(
        ["runtime-chat", selectedInstance.id],
        (current = EMPTY_CHAT_MESSAGES) =>
          mergeChatMessages(current, [
            payload.userMessage,
            payload.assistantMessage,
          ]),
      );
    },
  });

  async function handleSendChat() {
    const message = chatDraft.trim();
    if (!message || chatMutation.isPending || chatBlockState) {
      return;
    }
    await chatMutation.mutateAsync(message);
  }

  if (loading) {
    return (
      <PageContainer width="wide" className="py-4">
        <PageMotion>
          <div className="flex h-[calc(100dvh-6.5rem)] items-center justify-center rounded-[32px] border border-border/70 bg-card/90">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading helper workspace...
            </div>
          </div>
        </PageMotion>
      </PageContainer>
    );
  }

  if (!selectedCard && helperCards[0]) {
    return <Navigate to={`/agents/${helperCards[0].instance.agentId}`} replace />;
  }

  if (helperCards.length === 0) {
    return (
      <PageContainer width="wide">
        <div className="rounded-[32px] border border-dashed border-border/70 px-8 py-16 text-center">
          <p className="text-lg font-semibold text-foreground">No helpers yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your first helper to open the dedicated chat workspace.
          </p>
          <div className="mt-6">
            <Button asChild className="rounded-2xl">
              <Link to="/agents/new">New Helper</Link>
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer width="wide" className="space-y-0 py-4">
      <PageMotion>
        <div className="overflow-hidden rounded-[32px] border border-border/70 bg-card/95 shadow-[0_30px_70px_-38px_hsl(var(--foreground)/0.32)]">
          <div className="grid h-[calc(100dvh-6.5rem)] lg:grid-cols-[19rem_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col border-b border-border/70 bg-card/90 lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between gap-3 px-5 py-5">
                <div>
                  <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em] text-foreground">
                    Helpers
                  </h1>
                </div>
                {selectedAgent ? (
                  <HelperSettingsButton agentId={selectedAgent.id} />
                ) : null}
              </div>

              <div className="px-4 pb-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchValue}
                    onChange={(event) =>
                      startTransition(() => setSearchValue(event.target.value))
                    }
                    placeholder="Search helpers..."
                    className="rounded-2xl border-border/70 bg-muted/35 pl-9"
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
                <div className="space-y-2">
                  {filteredCards.map((card) => {
                    const isActive = card.instance.agentId === agentId;
                    const preview =
                      card.agent?.presetSummary ||
                      card.agent?.roleTitle ||
                      `${card.statusLabel} · ${card.updatedLabel}`;

                    return (
                      <Link
                        key={card.instance.id}
                        to={`/agents/${card.instance.agentId}`}
                        className={cn(
                          "block rounded-[22px] border px-3 py-3 transition-colors",
                          isActive
                            ? "border-primary/20 bg-primary/10"
                            : "border-transparent hover:border-border/70 hover:bg-muted/35",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <HelperAvatar
                              avatar={card.agent?.avatar}
                              helperName={card.agent?.name || card.instance.id}
                              className="mt-0.5 size-10 shrink-0 rounded-2xl"
                              fallbackClassName="text-xs"
                              imageSize={80}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-base font-semibold text-foreground">
                                  {card.agent?.name || card.instance.id}
                                </p>
                                <span
                                  className={cn(
                                    "inline-flex h-2.5 w-2.5 rounded-full",
                                    card.instance.status === "running"
                                      ? "bg-emerald-500"
                                      : "bg-muted-foreground/50",
                                  )}
                                />
                              </div>
                              <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                                {preview}
                              </p>
                            </div>
                          </div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            {card.instance.status === "running" ? "Live" : card.statusLabel}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </aside>

            <section className="flex min-h-0 flex-col bg-background/90">
              <div className="flex items-center justify-between gap-4 border-b border-border/70 px-6 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <HelperAvatar
                    avatar={selectedAgent?.avatar}
                    helperName={selectedAgent?.name || "Helper"}
                    className="size-11 shrink-0 rounded-2xl"
                    fallbackClassName="text-sm"
                    imageSize={88}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold tracking-[-0.03em] text-foreground">
                      {selectedAgent?.name || "Helper"}
                    </p>
                    <p className="truncate text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {selectedAgent?.roleTitle || selectedTenant?.name || "Helper"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <RuntimeStatusBadge
                    status={selectedInstance?.status ?? "unknown"}
                    className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.16em]"
                  />
                  {selectedAgent ? (
                    <HelperSettingsButton agentId={selectedAgent.id} />
                  ) : null}
                </div>
              </div>

              <div className="min-h-0 flex-1">
                <div className="h-full overflow-y-auto px-6 py-6">
                  <div className="space-y-4">
                    {onboardingStage === "first-chat" ? (
                      <AgentOnboardingFirstChatPanel
                        onSelectPrompt={(prompt) => setChatDraft(prompt)}
                      />
                    ) : null}

                    {onboardingStage === "next-steps" && selectedAgent ? (
                      <AgentOnboardingNextStepsPanel
                        agentId={selectedAgent.id}
                        onReplayHref="/agents/new?mode=onboarding"
                      />
                    ) : null}

                    {chatQuery.isLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading chat transcript...
                      </div>
                    ) : chatMessages.length === 0 ? (
                      chatBlockState ? (
                        <AgentChatStatePanel state={chatBlockState} />
                      ) : (
                        <div className="rounded-[24px] border border-dashed border-border/70 bg-background/80 p-5 text-sm text-muted-foreground">
                          No messages yet. Start the conversation below.
                        </div>
                      )
                    ) : (
                      <div className="space-y-5">
                        {chatMessages.map((message) => (
                          <AgentChatBubble key={message.id} message={message} />
                        ))}
                        {chatBlockState ? (
                          <AgentChatStatePanel state={chatBlockState} />
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-border/70 bg-card/85 px-4 py-4">
                <div className="overflow-hidden rounded-[24px] border border-border/70 bg-background shadow-[0_16px_34px_-26px_hsl(var(--foreground)/0.3)]">
                  {chatError ? (
                    <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                      {chatError}
                    </div>
                  ) : null}

                  {chatBlockState ? (
                    <div className="px-4 py-4 text-sm text-muted-foreground">
                      Open helper settings to finish setup before sending messages.
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-3 px-4 py-4">
                        <Textarea
                          value={chatDraft}
                          onChange={(event) => setChatDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                              event.preventDefault();
                              void handleSendChat();
                            }
                          }}
                          rows={2}
                          placeholder={`Message ${selectedAgent?.name || "helper"}...`}
                          disabled={chatMutation.isPending}
                          className="min-h-[72px] resize-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
                        />
                        <Button
                          type="button"
                          size="icon"
                          className="mt-1 shrink-0 rounded-2xl"
                          aria-label="Send message"
                          disabled={
                            chatMutation.isPending || chatDraft.trim().length === 0
                          }
                          onClick={() => void handleSendChat()}
                        >
                          {chatMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <div className="border-t border-border/70 px-4 py-2 text-xs text-muted-foreground">
                        Press Enter to send. Use Shift+Enter for a new line.
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </PageMotion>
    </PageContainer>
  );
}

function HelperSettingsButton({ agentId }: { agentId: string }) {
  return (
    <Button asChild variant="ghost" size="icon" aria-label="Open helper settings">
      <Link to={`/agents/${agentId}/settings`}>
        <Settings2 className="h-4 w-4" />
      </Link>
    </Button>
  );
}

function AgentChatBubble({ message }: { message: RuntimeChatMessage }) {
  const isUser = message.role === "user";
  const isError = message.role === "error";
  const bubbleClassName = isError
    ? "border-destructive/30 bg-destructive/5"
    : isUser
      ? "border-primary/20 bg-primary text-primary-foreground"
      : "border-border/70 bg-card";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className="max-w-[78%]">
        <div className={cn("rounded-[22px] border px-4 py-3 shadow-sm", bubbleClassName)}>
          <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
        </div>
        <p
          className={cn(
            "mt-2 px-1 text-[11px]",
            isUser ? "text-right text-muted-foreground" : "text-muted-foreground",
          )}
        >
          {formatRelativeDate(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

function AgentChatStatePanel({
  state,
}: {
  state: { title: string; body: string; actionLabel?: string; actionHref?: string };
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-border/70 bg-background/80 p-4">
      <p className="text-sm font-medium">{state.title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{state.body}</p>
      {state.actionLabel && state.actionHref ? (
        <Link to={state.actionHref} className="mt-4 inline-flex">
          <Button variant="outline" size="sm" className="rounded-2xl">
            {state.actionLabel}
          </Button>
        </Link>
      ) : null}
    </div>
  );
}

function AgentOnboardingFirstChatPanel({
  onSelectPrompt,
}: {
  onSelectPrompt: (prompt: string) => void;
}) {
  return (
    <div className="rounded-[24px] border border-primary/20 bg-primary/5 p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-primary/80">
        First success
      </p>
      <p className="mt-2 text-xl font-semibold text-foreground">
        {ONBOARDING_COPY.firstChat.title}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {ONBOARDING_COPY.firstChat.description}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {ONBOARDING_PROMPTS.map((prompt) => (
          <Button
            key={prompt}
            type="button"
            variant="outline"
            size="sm"
            className="rounded-2xl"
            onClick={() => onSelectPrompt(prompt)}
          >
            {prompt}
          </Button>
        ))}
      </div>
    </div>
  );
}

function AgentOnboardingNextStepsPanel({
  agentId,
  onReplayHref,
}: {
  agentId: string;
  onReplayHref: string;
}) {
  return (
    <div className="rounded-[24px] border border-primary/20 bg-primary/5 p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-primary/80">
        You are ready
      </p>
      <p className="mt-2 text-xl font-semibold text-foreground">
        {ONBOARDING_COPY.nextSteps.title}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {ONBOARDING_COPY.nextSteps.description}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link to={`/agents/${agentId}/settings?tab=runtime`}>
          <Button variant="outline" className="rounded-2xl">
            Review helper settings
          </Button>
        </Link>
        <Link to={`/agents/${agentId}/settings?tab=channels`}>
          <Button variant="outline" className="rounded-2xl">
            Connect a channel later
          </Button>
        </Link>
        <Button asChild variant="ghost" className="rounded-2xl">
          <Link to={onReplayHref}>Create another helper</Link>
        </Button>
      </div>
    </div>
  );
}

function getAgentChatBlockState(
  instance:
    | {
        status: string;
        baseUrl?: string;
        requirePairing: boolean;
        hasToken: boolean;
        agentId: string;
      }
    | undefined,
  runtime: { capabilities: { chatAction?: boolean } } | undefined,
) {
  if (!instance) {
    return {
      title: "Runtime unavailable",
      body: "This helper needs to be provisioned before chat can start.",
    };
  }
  if (instance.status !== "running") {
    return {
      title: "Runtime unavailable",
      body: "Start the helper before sending a message.",
      actionLabel: "Open settings",
      actionHref: `/agents/${instance.agentId}/settings?tab=runtime`,
    };
  }
  if (!instance.baseUrl?.trim()) {
    return {
      title: "Runtime endpoint unavailable",
      body: "Atoll does not have a published runtime endpoint for this helper yet. Re-start or repair the helper, then try again.",
      actionLabel: "Open settings",
      actionHref: `/agents/${instance.agentId}/settings?tab=runtime`,
    };
  }
  if (instance.requirePairing && !instance.hasToken) {
    return {
      title: "Token or pairing required",
      body: "Finish pairing or save an access key in helper settings before using chat.",
      actionLabel: "Open settings",
      actionHref: `/agents/${instance.agentId}/settings?tab=runtime`,
    };
  }
  if (!runtime?.capabilities.chatAction) {
    return {
      title: "Runtime image does not support chat",
      body: "This runtime stays manageable in Atoll, but it does not expose the chat contract yet.",
    };
  }
  return undefined;
}

function mergeChatMessages(
  existing: RuntimeChatMessage[],
  incoming: RuntimeChatMessage[],
) {
  const byId = new Map<string, RuntimeChatMessage>();
  for (const message of [...existing, ...incoming]) {
    byId.set(message.id, message);
  }
  return [...byId.values()].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
}
