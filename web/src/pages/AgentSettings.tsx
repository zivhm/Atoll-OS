import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  Bot,
  ChevronDown,
  Download,
  File as FileIcon,
  FolderOpen,
  HeartPulse,
  Info,
  Loader2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { AgentAvatarField } from "@/components/AgentAvatarField";
import { AgentSkillsSettingsPanel } from "@/components/AgentSkillsSettingsPanel";
import { RuntimeTracePanel } from "@/components/RuntimeTracePanel";
import { RuntimeConfigFields } from "@/components/RuntimeConfigFields";
import {
  DiscordIntegrationCard,
  SlackIntegrationCard,
  TelegramIntegrationCard,
} from "@/components/HelperChannelIntegrations";
import { HelperAvatar } from "@/components/HelperAvatar";
import { LabeledField } from "@/components/LabeledField";
import { ModelPickerField } from "@/components/ModelPickerField";
import { RuntimeStatusBadge } from "@/components/RuntimeStatusBadge";
import { ActionBar, ActionGroup } from "@/components/layout/ActionBar";
import { KeyValueGrid, KeyValueItem } from "@/components/layout/KeyValueGrid";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageMotion } from "@/components/layout/PageMotion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useOnboarding } from "@/hooks/use-onboarding";
import {
  deleteRuntime,
  deleteRuntimeSharedFile,
  downloadRuntimeSharedFile,
  checkRuntimeSlackOnboarding,
  exportRuntimeEvents,
  exportRuntimeTrace,
  getAgentSkillsCatalog,
  getErrorMessage,
  getRuntimeChatErrorMessage,
  getModelCatalog,
  getRuntimeContainerLogs,
  getRuntimeInstance,
  getRuntimeDiagnostics,
  getRuntimeHealth,
  getRuntimePairingInfo,
  getRuntimeTrace,
  getRuntimeSlackOnboarding,
  listAgents,
  listRuntimeCatalog,
  listRuntimeChatMessages,
  listRuntimeEvents,
  listRuntimeTraces,
  listRuntimeSharedFiles,
  listRuntimeInstances,
  listTenants,
  pairRuntime,
  repairRuntime,
  restartRuntime,
  sendRuntimeChat,
  sendRuntimeWebhook,
  setRuntimeToken as storeRuntimeToken,
  startRuntime,
  stopRuntime,
  syncRuntime,
  uploadRuntimeSharedFiles,
  updateAgent,
  updateRuntimeConfig,
  updateRuntimeDiscord,
  updateRuntimeLlm,
  updateRuntimeSlack,
  updateRuntimeTelegram,
  type RuntimeChatMessage,
  type RuntimeSharedFile,
  type RuntimeSharedFileUploadInput,
  type RuntimeSlackOnboarding,
  type RuntimeSlackOnboardingCheckResponse,
  type RuntimeCatalogItem,
} from "@/lib/api";
import { createRandomAgentAvatar } from "@/lib/agent-avatar";
import {
  buildHelperDetailModel,
  formatEventActionLabel,
  formatRelativeDate,
  getVisibleRuntimeCatalog,
  parseIntegrationIdListInput,
  parseTelegramAllowListInput,
  resolvePreferredRuntime,
} from "@/lib/models";
import {
  DEFAULT_LLM_PROVIDER,
  FALLBACK_MODEL_ITEMS,
} from "@/lib/model-catalog";
import {
  getOnboardingStage,
  ONBOARDING_COPY,
  ONBOARDING_PROMPTS,
} from "@/lib/onboarding";
import {
  buildRuntimeConfigFormState,
  parseRuntimeConfigFormState,
  type RuntimeConfigFormState,
} from "@/lib/runtime-config";
import {
  chunkRuntimeSharedUploadItems,
  extractRuntimeSharedUploadItemsFromDataTransfer,
  normalizeRuntimeSharedUploadItemsFromFileList
} from "@/lib/runtime-shared-upload";
import {
  buildRuntimeSharedFileTree,
  listRuntimeSharedFilesInFolder,
  type RuntimeSharedFileTreeNode,
} from "@/lib/runtime-shared-files-tree";
import { cn } from "@/lib/utils";

const RUNTIME_REFRESH_INTERVAL_MS = 5000;
type AgentSettingsTab = "overview" | "skills" | "runtime" | "shared-files" | "channels";
const EMPTY_CHAT_MESSAGES: RuntimeChatMessage[] = [];

export default function AgentSettings() {
  const { agentId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { progress, markFirstChatCompleted } = useOnboarding();
  const activeTab = parseAgentSettingsTab(searchParams.get("tab")) ?? "overview";
  const [agentName, setAgentName] = useState("");
  const [agentRoleTitle, setAgentRoleTitle] = useState("");
  const [agentAvatar, setAgentAvatar] = useState<ReturnType<typeof createRandomAgentAvatar> | undefined>(createRandomAgentAvatar);
  const [llmModel, setLlmModel] = useState("");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramAllowList, setTelegramAllowList] = useState("");
  const [replyInPrivate, setReplyInPrivate] = useState(true);
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [slackBotToken, setSlackBotToken] = useState("");
  const [slackAppToken, setSlackAppToken] = useState("");
  const [slackAllowedChannelIds, setSlackAllowedChannelIds] = useState("");
  const [slackAllowedUserIds, setSlackAllowedUserIds] = useState("");
  const [slackReplyInThread, setSlackReplyInThread] = useState(true);
  const [discordEnabled, setDiscordEnabled] = useState(false);
  const [discordBotToken, setDiscordBotToken] = useState("");
  const [discordAllowedUserIds, setDiscordAllowedUserIds] = useState("");
  const [discordAllowedGuildIds, setDiscordAllowedGuildIds] = useState("");
  const [discordAllowedChannelIds, setDiscordAllowedChannelIds] = useState("");
  const [discordReplyInThread, setDiscordReplyInThread] = useState(true);
  const [discordRequireMention, setDiscordRequireMention] = useState(true);
  const [pairingCode, setPairingCode] = useState("");
  const [runtimeToken, setRuntimeToken] = useState("");
  const [webhookToken, setWebhookToken] = useState("");
  const [webhookMessage, setWebhookMessage] = useState("Ping from Atoll");
  const [runtimeConfigValues, setRuntimeConfigValues] = useState<RuntimeConfigFormState>({});
  const [diagnosticsOutput, setDiagnosticsOutput] = useState("");
  const [selectedTraceId, setSelectedTraceId] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [chatError, setChatError] = useState("");
  const [slackOnboardingCheckResult, setSlackOnboardingCheckResult] = useState<
    RuntimeSlackOnboardingCheckResponse | undefined
  >(undefined);

  const agentsQuery = useQuery({ queryKey: ["agents"], queryFn: () => listAgents() });
  const tenantsQuery = useQuery({ queryKey: ["tenants"], queryFn: listTenants });
  const instancesQuery = useQuery({ queryKey: ["instances"], queryFn: () => listRuntimeInstances() });
  const runtimeCatalogQuery = useQuery({ queryKey: ["runtime-catalog"], queryFn: listRuntimeCatalog });
  const modelCatalogQuery = useQuery({
    queryKey: ["model-catalog", DEFAULT_LLM_PROVIDER],
    queryFn: () => getModelCatalog(DEFAULT_LLM_PROVIDER),
    retry: 0,
  });
  const skillCatalogQuery = useQuery({
    queryKey: ["agent-skill-catalog", agentId],
    queryFn: () => getAgentSkillsCatalog(agentId),
    enabled: Boolean(agentId),
  });
  const instanceId = (instancesQuery.data ?? []).find((item) => item.agentId === agentId)?.id;
  const isChatTabActive = activeTab === "overview";
  const isRuntimeTabActive = activeTab === "runtime";
  const eventsQuery = useQuery({
    queryKey: ["events", instanceId],
    queryFn: () => listRuntimeEvents(instanceId, 25),
    enabled: Boolean(instanceId),
    refetchInterval: isRuntimeTabActive ? RUNTIME_REFRESH_INTERVAL_MS : false,
  });
  const detail = buildHelperDetailModel({
    agentId,
    agents: agentsQuery.data ?? [],
    tenants: tenantsQuery.data ?? [],
    instances: instancesQuery.data ?? [],
    events: eventsQuery.data ?? [],
  });
  const runtimeCatalog = useMemo(
    () => getVisibleRuntimeCatalog(runtimeCatalogQuery.data ?? []),
    [runtimeCatalogQuery.data]
  );
  const selectedRuntime = detail.instance
    ? resolvePreferredRuntime(runtimeCatalog, detail.instance.runtimeType)
    : undefined;
  const runtimeInstanceQuery = useQuery({
    queryKey: ["runtime-instance", instanceId],
    queryFn: () => getRuntimeInstance(instanceId!),
    enabled: Boolean(instanceId && isRuntimeTabActive),
    refetchInterval: isRuntimeTabActive ? RUNTIME_REFRESH_INTERVAL_MS : false,
  });
  const diagnosticsQuery = useQuery({
    queryKey: ["diagnostics", instanceId],
    queryFn: () => getRuntimeDiagnostics(instanceId),
    enabled: Boolean(instanceId && isRuntimeTabActive),
    refetchInterval: isRuntimeTabActive ? RUNTIME_REFRESH_INTERVAL_MS : false,
  });
  const containerLogsQuery = useQuery({
    queryKey: ["runtime-container-logs", instanceId],
    queryFn: () => getRuntimeContainerLogs(instanceId!, 250),
    enabled: Boolean(instanceId && isRuntimeTabActive),
    refetchInterval: isRuntimeTabActive ? RUNTIME_REFRESH_INTERVAL_MS : false,
  });
  const traceRunsQuery = useQuery({
    queryKey: ["runtime-traces", instanceId],
    queryFn: () => listRuntimeTraces(instanceId!, 25),
    enabled: Boolean(instanceId && isRuntimeTabActive),
    refetchInterval: isRuntimeTabActive ? RUNTIME_REFRESH_INTERVAL_MS : false,
  });
  const traceDetailQuery = useQuery({
    queryKey: ["runtime-trace-detail", instanceId, selectedTraceId],
    queryFn: () => getRuntimeTrace(instanceId!, selectedTraceId),
    enabled: Boolean(instanceId && selectedTraceId && isRuntimeTabActive),
  });
  const pairingInfoQuery = useQuery({
    queryKey: ["pairing-info", instanceId],
    queryFn: () => getRuntimePairingInfo(instanceId!),
    enabled: Boolean(instanceId && selectedRuntime?.capabilities.pairingInfo && detail.instance?.requirePairing),
  });
  const slackOnboardingQuery = useQuery({
    queryKey: ["runtime-slack-onboarding", instanceId],
    queryFn: () => getRuntimeSlackOnboarding(instanceId!),
    enabled: Boolean(instanceId),
  });
  const chatQuery = useQuery({
    queryKey: ["runtime-chat", instanceId],
    queryFn: () => listRuntimeChatMessages(instanceId!, 100),
    enabled: Boolean(instanceId && isChatTabActive),
  });

  useEffect(() => {
    if (!detail.agent) return;
    setAgentName(detail.agent.name);
    setAgentRoleTitle(detail.agent.roleTitle ?? "");
    setAgentAvatar(detail.agent.avatar);
  }, [detail.agent]);

  useEffect(() => {
    if (!detail.instance) return;
    setLlmModel(detail.instance.llmModel);
    setLlmApiKey("");
    setTelegramEnabled(detail.instance.telegramEnabled);
    setTelegramToken("");
    setTelegramAllowList(detail.instance.telegramAllowFrom.join(", "));
    setReplyInPrivate(detail.instance.telegramReplyInPrivate);
    setSlackEnabled(detail.instance.slackEnabled);
    setSlackBotToken("");
    setSlackAppToken("");
    setSlackAllowedChannelIds(detail.instance.slackAllowedChannelIds.join(", "));
    setSlackAllowedUserIds(detail.instance.slackAllowedUserIds.join(", "));
    setSlackReplyInThread(detail.instance.slackReplyInThread);
    setDiscordEnabled(detail.instance.discordEnabled);
    setDiscordBotToken("");
    setDiscordAllowedUserIds(detail.instance.discordAllowedUserIds.join(", "));
    setDiscordAllowedGuildIds(detail.instance.discordAllowedGuildIds.join(", "));
    setDiscordAllowedChannelIds(detail.instance.discordAllowedChannelIds.join(", "));
    setDiscordReplyInThread(detail.instance.discordReplyInThread);
    setDiscordRequireMention(detail.instance.discordRequireMention);
    setRuntimeConfigValues(
      selectedRuntime
        ? buildRuntimeConfigFormState({
            fields: selectedRuntime.runtimeConfigFields,
            runtimeOptions: detail.instance.runtimeOptions,
          })
        : {}
    );
    setSlackOnboardingCheckResult(undefined);
    setChatDraft("");
    setChatError("");
    setSelectedTraceId("");
  }, [detail.instance, selectedRuntime]);

  useEffect(() => {
    if (diagnosticsQuery.data) {
      setDiagnosticsOutput(JSON.stringify(diagnosticsQuery.data, null, 2));
    }
  }, [diagnosticsQuery.data]);

  useEffect(() => {
    const traces = traceRunsQuery.data ?? [];
    if (traces.length === 0) {
      if (selectedTraceId) {
        setSelectedTraceId("");
      }
      return;
    }
    if (!traces.some((trace) => trace.id === selectedTraceId)) {
      setSelectedTraceId(traces[0]?.id ?? "");
    }
  }, [selectedTraceId, traceRunsQuery.data]);

  const chatMessages = chatQuery.data ?? EMPTY_CHAT_MESSAGES;
  const onboardingStage = getOnboardingStage({
    progress,
    hasHelpers: Boolean(detail.agent),
    hasSelectedHelper: Boolean(detail.agent),
  });
  const chatBlockState = getAgentChatBlockState(detail.instance, selectedRuntime);

  useEffect(() => {
    if (
      !detail.instance ||
      !progress.helperCreated ||
      progress.firstChatCompleted ||
      !chatMessages.some((message) => message.role === "assistant")
    ) {
      return;
    }

    markFirstChatCompleted();
  }, [
    chatMessages,
    detail.instance,
    markFirstChatCompleted,
    progress.firstChatCompleted,
    progress.helperCreated,
  ]);

  const runtimeActionMutation = useMutation({
    mutationFn: async (action: "health" | "start" | "stop" | "restart" | "sync" | "repair" | "delete") => {
      if (!detail.instance) {
        throw new Error("No runtime instance found for this helper");
      }

      switch (action) {
        case "health":
          return getRuntimeHealth(detail.instance.id);
        case "start":
          return startRuntime(detail.instance.id);
        case "stop":
          return stopRuntime(detail.instance.id);
        case "restart":
          return restartRuntime(detail.instance.id);
        case "sync":
          return syncRuntime(detail.instance.id);
        case "repair":
          return repairRuntime(detail.instance.id);
        case "delete":
          return deleteRuntime(detail.instance.id, true);
      }
    },
    onSuccess: async (payload) => {
      setDiagnosticsOutput(JSON.stringify(payload, null, 2));
      toast.success("Helper action completed");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["instances"] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
        queryClient.invalidateQueries({ queryKey: ["diagnostics"] }),
        queryClient.invalidateQueries({ queryKey: ["runtime-container-logs"] }),
      ]);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Helper action failed"));
    },
  });

  const agentMutation = useMutation({
    mutationFn: async () => {
      if (!detail.agent) throw new Error("No helper found");
      return updateAgent(detail.agent.id, {
        name: agentName,
        roleTitle: agentRoleTitle,
        avatar: agentAvatar,
      });
    },
    onSuccess: async (payload) => {
      toast.success("Helper profile saved");
      setAgentName(payload.agent.name);
      setAgentRoleTitle(payload.agent.roleTitle ?? "");
      setAgentAvatar(payload.agent.avatar);
      await queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Could not save helper profile"));
    },
  });

  const agentSkillsMutation = useMutation({
    mutationFn: async (input: {
      skills: string[];
      installedSkills: NonNullable<typeof detail.agent>["installedSkills"];
    }) => {
      if (!detail.agent) throw new Error("No helper found");
      return updateAgent(detail.agent.id, input);
    },
    onSuccess: async (payload) => {
      const message =
        payload.workspaceSync.status === "synced"
          ? "Skills saved and workspace synced"
          : payload.workspaceSync.status === "deferred"
            ? "Skills saved. Workspace sync will run at next provision."
            : "Skills saved";
      toast.success(message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["agents"] }),
        queryClient.invalidateQueries({ queryKey: ["agent-skill-catalog", agentId] })
      ]);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Could not save helper skills"));
    }
  });

  const llmMutation = useMutation({
    mutationFn: async () => {
      if (!detail.instance) throw new Error("No runtime instance found");
      return updateRuntimeLlm(detail.instance.id, {
        provider: DEFAULT_LLM_PROVIDER,
        model: llmModel,
        apiKey: llmApiKey,
      });
    },
    onSuccess: async (payload) => {
      setDiagnosticsOutput(JSON.stringify(payload, null, 2));
      toast.success("AI settings saved");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["instances"] }),
        queryClient.invalidateQueries({ queryKey: ["diagnostics"] }),
      ]);
      setLlmApiKey("");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Could not save AI settings"));
    },
  });

  const telegramMutation = useMutation({
    mutationFn: async () => {
      if (!detail.instance || !selectedRuntime) throw new Error("No runtime instance found");
      const parsed = selectedRuntime.capabilities.telegramAllowFrom
        ? parseTelegramAllowListInput(telegramAllowList, { strict: true })
        : { entries: detail.instance.telegramAllowFrom, invalid: [], warnings: [] };

      return updateRuntimeTelegram(detail.instance.id, {
        enabled: telegramEnabled,
        telegramBotToken: selectedRuntime.capabilities.telegramToken ? telegramToken || undefined : undefined,
        telegramAllowFrom: selectedRuntime.capabilities.telegramAllowFrom ? parsed.entries : detail.instance.telegramAllowFrom,
        ...(selectedRuntime.capabilities.telegramReplyInPrivate
          ? { telegramReplyInPrivate: replyInPrivate }
          : {}),
      });
    },
    onSuccess: async (payload) => {
      setDiagnosticsOutput(JSON.stringify(payload, null, 2));
      toast.success("Telegram settings saved");
      await queryClient.invalidateQueries({ queryKey: ["instances"] });
      setTelegramToken("");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Could not save Telegram settings"));
    },
  });

  const slackMutation = useMutation({
    mutationFn: async () => {
      if (!detail.instance) throw new Error("No runtime instance found");
      return updateRuntimeSlack(detail.instance.id, {
        enabled: slackEnabled,
        slackBotToken: slackBotToken || undefined,
        slackAppToken: slackAppToken || undefined,
        slackAllowedChannelIds: parseIntegrationIdListInput(slackAllowedChannelIds),
        slackAllowedUserIds: parseIntegrationIdListInput(slackAllowedUserIds),
        slackReplyInThread,
      });
    },
    onSuccess: async (payload) => {
      setDiagnosticsOutput(JSON.stringify(payload, null, 2));
      toast.success("Slack settings saved");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["instances"] }),
        queryClient.invalidateQueries({ queryKey: ["runtime-slack-onboarding", detail.instance?.id] }),
      ]);
      setSlackOnboardingCheckResult(undefined);
      setSlackBotToken("");
      setSlackAppToken("");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Could not save Slack settings"));
    },
  });

  const slackOnboardingCheckMutation = useMutation({
    mutationFn: async () => {
      if (!detail.instance) throw new Error("No runtime instance found");
      return checkRuntimeSlackOnboarding(detail.instance.id);
    },
    onSuccess: (payload) => {
      setSlackOnboardingCheckResult(payload);
      if (payload.status === "ready") {
        toast.success("Slack onboarding is ready");
      } else {
        toast.error("Slack onboarding still needs setup");
      }
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Could not run Slack onboarding check"));
    },
  });

  const discordMutation = useMutation({
    mutationFn: async () => {
      if (!detail.instance) throw new Error("No runtime instance found");
      return updateRuntimeDiscord(detail.instance.id, {
        enabled: discordEnabled,
        discordBotToken: discordBotToken || undefined,
        discordAllowedUserIds: parseIntegrationIdListInput(discordAllowedUserIds),
        discordAllowedGuildIds: parseIntegrationIdListInput(discordAllowedGuildIds),
        discordAllowedChannelIds: parseIntegrationIdListInput(discordAllowedChannelIds),
        discordReplyInThread,
        discordRequireMention,
      });
    },
    onSuccess: async (payload) => {
      setDiagnosticsOutput(JSON.stringify(payload, null, 2));
      toast.success("Discord settings saved");
      await queryClient.invalidateQueries({ queryKey: ["instances"] });
      setDiscordBotToken("");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Could not save Discord settings"));
    },
  });

  const runtimeConfigMutation = useMutation({
    mutationFn: async () => {
      if (!detail.instance || !selectedRuntime) throw new Error("No runtime instance found");
      const payload = parseRuntimeConfigFormState({
        fields: selectedRuntime.runtimeConfigFields,
        values: runtimeConfigValues,
      });

      return updateRuntimeConfig(detail.instance.id, payload);
    },
    onSuccess: async (payload) => {
      setDiagnosticsOutput(JSON.stringify(payload, null, 2));
      toast.success("Engine settings saved");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["instances"] }),
        queryClient.invalidateQueries({ queryKey: ["diagnostics"] }),
      ]);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Could not save engine settings"));
    },
  });

  const pairMutation = useMutation({
    mutationFn: async () => {
      if (!detail.instance) throw new Error("No runtime instance found");
      return pairRuntime(detail.instance.id, pairingCode);
    },
    onSuccess: async (payload) => {
      setDiagnosticsOutput(JSON.stringify(payload, null, 2));
      toast.success("Connection code saved");
      await queryClient.invalidateQueries({ queryKey: ["instances"] });
      setPairingCode("");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Could not save the connection code"));
    },
  });

  const tokenMutation = useMutation({
    mutationFn: async () => {
      if (!detail.instance) throw new Error("No runtime instance found");
      return storeRuntimeToken(detail.instance.id, runtimeToken);
    },
    onSuccess: async (payload) => {
      setDiagnosticsOutput(JSON.stringify(payload, null, 2));
      toast.success("Access key saved");
      await queryClient.invalidateQueries({ queryKey: ["instances"] });
      setRuntimeToken("");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Could not save the access key"));
    },
  });

  const webhookMutation = useMutation({
    mutationFn: async () => {
      if (!detail.instance) throw new Error("No runtime instance found");
      return sendRuntimeWebhook(detail.instance.id, {
        message: webhookMessage,
        token: webhookToken || undefined,
      });
    },
    onSuccess: (payload) => {
      setDiagnosticsOutput(JSON.stringify(payload, null, 2));
      toast.success("Webhook request sent");
      setWebhookToken("");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Webhook request failed"));
    },
  });
  const exportEventsMutation = useMutation({
    mutationFn: async (scope: "instance" | "org") => {
      if (scope === "instance") {
        if (!detail.instance) throw new Error("No runtime instance found");
        return exportRuntimeEvents(detail.instance.id);
      }
      return exportRuntimeEvents();
    },
    onSuccess: (payload, scope) => {
      setDiagnosticsOutput(JSON.stringify(payload, null, 2));
      toast.success(scope === "instance" ? "Helper activity exported" : "All helper activity exported");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Could not export activity"));
    },
  });
  const exportTraceMutation = useMutation({
    mutationFn: async (traceId: string) => {
      if (!detail.instance) throw new Error("No runtime instance found");
      return exportRuntimeTrace(detail.instance.id, traceId);
    },
    onSuccess: (payload) => {
      setDiagnosticsOutput(JSON.stringify(payload, null, 2));
      toast.success("Trace export ready");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Could not export trace"));
    },
  });
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!detail.instance) throw new Error("No runtime instance found");
      return sendRuntimeChat(detail.instance.id, { message });
    },
    onSuccess: async (payload) => {
      if (!detail.instance) return;
      queryClient.setQueryData<RuntimeChatMessage[]>(
        ["runtime-chat", detail.instance.id],
        (current = []) =>
          mergeChatMessages(current, [
            payload.userMessage,
            payload.assistantMessage,
          ].filter(Boolean) as RuntimeChatMessage[])
      );
      setChatDraft("");
      setChatError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["runtime-chat", detail.instance.id] }),
        queryClient.invalidateQueries({ queryKey: ["runtime-traces", detail.instance.id] }),
      ]);
    },
    onError: (error) => {
      setChatError(getRuntimeChatErrorMessage(error, "Could not send message"));
    },
  });

  if (agentsQuery.isLoading || tenantsQuery.isLoading || instancesQuery.isLoading || runtimeCatalogQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!detail.agent) {
    return (
      <PageContainer width="narrow" className="py-12">
        <Card className="border-border/70 bg-card/85">
          <CardContent className="p-8 text-center">
            <p className="text-lg font-semibold">Helper not found</p>
            <p className="mt-2 text-sm text-muted-foreground">
              The requested helper does not exist in this workspace, or you no longer have access to it.
            </p>
            <Link to="/dashboard" className="mt-6 inline-flex">
              <Button>Back to helpers</Button>
            </Link>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  const supportsLlmConfig = Boolean(selectedRuntime?.capabilities.llmConfig);
  const supportsTelegramConfig = Boolean(
    selectedRuntime &&
      (selectedRuntime.capabilities.telegramToken ||
        selectedRuntime.capabilities.telegramAllowFrom ||
        selectedRuntime.capabilities.telegramReplyInPrivate)
  );
  const supportsPairing = Boolean(selectedRuntime?.capabilities.pairingInfo || selectedRuntime?.capabilities.pairingAction);
  const supportsWebhook = Boolean(selectedRuntime?.capabilities.webhookAction);
  const supportsRuntimeConfig = Boolean(selectedRuntime && selectedRuntime.runtimeConfigFields.length > 0);
  const liveInstance = runtimeInstanceQuery.data ?? detail.instance;
  const modelCatalogItems = modelCatalogQuery.data?.items?.length
    ? modelCatalogQuery.data.items.map((item) => ({
        id: item.id,
        name: item.name,
        promptPricePer1M: item.promptPricePer1M,
        completionPricePer1M: item.completionPricePer1M,
      }))
      : FALLBACK_MODEL_ITEMS;
  const modelCatalogStatusText = modelCatalogQuery.isLoading
    ? "Loading model catalog..."
    : modelCatalogQuery.isError
      ? "Model catalog unavailable. Fallback suggestions are shown."
      : `${modelCatalogItems.length} model suggestions available.`;
  const enabledIntegrations = [
    liveInstance?.telegramEnabled ? "Telegram" : null,
    liveInstance?.slackEnabled ? "Slack" : null,
    liveInstance?.discordEnabled ? "Discord" : null,
  ].filter((value): value is string => Boolean(value));
  const slackHasUnsavedChanges = Boolean(detail.instance) && (
    slackEnabled !== detail.instance?.slackEnabled ||
    slackReplyInThread !== detail.instance?.slackReplyInThread ||
    !areStringArraysEqual(parseIntegrationIdListInput(slackAllowedChannelIds), detail.instance?.slackAllowedChannelIds ?? []) ||
    !areStringArraysEqual(parseIntegrationIdListInput(slackAllowedUserIds), detail.instance?.slackAllowedUserIds ?? []) ||
    slackBotToken.trim().length > 0 ||
    slackAppToken.trim().length > 0
  );
  const runtimeEventLog = (eventsQuery.data ?? [])
    .map((event) => `${new Date(event.createdAt).toLocaleString()} | ${formatEventActionLabel(event.action)} | ${event.message || event.outcome}`)
    .join("\n");
  const containerLogExcerpt =
    containerLogsQuery.data?.logs?.trim() ||
    pairingInfoQuery.data?.logExcerpt?.trim() ||
    diagnosticsQuery.data?.container?.message?.trim() ||
    "";
  const runtimeTone =
    liveInstance?.status === "running"
      ? "ok"
      : liveInstance?.status === "error"
        ? "error"
        : liveInstance?.status === "provisioning"
          ? "warn"
          : "idle";
  const liveBadgeClassName =
    runtimeTone === "ok"
      ? "border-emerald-300/40 bg-emerald-500/12 text-emerald-800 dark:border-emerald-500/25 dark:text-emerald-200"
      : runtimeTone === "warn"
        ? "border-amber-300/40 bg-amber-500/12 text-amber-800 dark:border-amber-500/25 dark:text-amber-200"
        : "border-border/70 bg-muted text-muted-foreground";

  async function handleSendChat() {
    const message = chatDraft.trim();
    if (!message || chatMutation.isPending || chatBlockState) {
      return;
    }
    await chatMutation.mutateAsync(message);
  }

  function handleTabChange(value: string) {
    const nextTab = value as AgentSettingsTab;
    if (nextTab === activeTab) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextTab === "overview") {
      if (!nextSearchParams.has("tab")) {
        return;
      }
      nextSearchParams.delete("tab");
    } else {
      nextSearchParams.set("tab", nextTab);
    }
    setSearchParams(nextSearchParams, { replace: true });
  }

  return (
    <PageContainer width="wide" className="space-y-6">
      <PageMotion>
        <div className="space-y-4">
          <Link
            to={`/agents/${agentId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to chat
          </Link>
          <PageHeader
            eyebrow={detail.tenant?.name || "Workspace"}
            title={detail.agent.name}
            description="Manage this helper's configuration, shared files, and channels."
          />
        </div>
      </PageMotion>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Card className="rounded-[28px] border-border/70 bg-card/90">
              <CardHeader className="space-y-4">
                <div className="flex items-center gap-3">
                  <HelperAvatar
                    avatar={detail.agent.avatar}
                    helperName={detail.agent.name}
                    className="size-12 rounded-2xl"
                    fallbackClassName="text-sm"
                    imageSize={96}
                  />
                  {/* <div className="min-w-0">
                    <CardTitle className="truncate text-xl">Helper workspace</CardTitle>
                    <p className="truncate text-sm uppercase tracking-[0.18em] text-muted-foreground">
                      {detail.agent.roleTitle || "Helper"}
                    </p>
                  </div> */}
                </div>
                <RuntimeStatusBadge status={detail.instance?.status ?? "unknown"} />
                <p className="text-sm text-muted-foreground">
                  {detail.agent.presetSummary || ""}
                </p>
              </CardHeader>
            </Card>

            <TabsList className="flex h-auto w-full flex-col items-stretch justify-start gap-1 rounded-[28px] border border-border/70 bg-card/70 p-3">
              <TabsTrigger value="overview" className="atoll-rail-button justify-start gap-3 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-none">
                <Bot className="h-4 w-4" /> Overview
              </TabsTrigger>
              <TabsTrigger value="skills" className="atoll-rail-button justify-start gap-3 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-none">
                <Wrench className="h-4 w-4" /> Skills
              </TabsTrigger>
              <TabsTrigger value="shared-files" className="atoll-rail-button justify-start gap-3 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-none">
                <FolderOpen className="h-4 w-4" /> Shared files
              </TabsTrigger>
              <TabsTrigger value="channels" className="atoll-rail-button justify-start gap-3 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-none">
                <Send className="h-4 w-4" /> Channels
              </TabsTrigger>
              <TabsTrigger value="runtime" className="atoll-rail-button justify-start gap-3 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-none">
                <PlayCircle className="h-4 w-4" /> Advanced
              </TabsTrigger>
            </TabsList>
          </aside>

          <div className="space-y-4">
            <TabsContent value="skills" className="mt-0 space-y-4">
              <AgentSkillsSettingsPanel
                agent={detail.agent}
                catalogItems={skillCatalogQuery.data ?? []}
                savePending={agentSkillsMutation.isPending}
                onSave={(input) => agentSkillsMutation.mutateAsync(input)}
              />
            </TabsContent>
            <TabsContent value="runtime" className="mt-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Runtime controls</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionBar>
                <ActionGroup>
                  <ActionButton
                    label="Health check"
                    helpText="Runs a quick runtime probe and reports whether the helper is reachable."
                    disabled={!detail.instance}
                    onClick={() => void runtimeActionMutation.mutateAsync("health")}
                  >
                    <HeartPulse className="h-4 w-4" />
                  </ActionButton>
                </ActionGroup>
                <ActionGroup>
                  <ActionButton
                    label="Start helper"
                    helpText="Starts the helper runtime container if it is currently stopped."
                    disabled={!detail.instance}
                    onClick={() => void runtimeActionMutation.mutateAsync("start")}
                  >
                    <PlayCircle className="h-4 w-4" />
                  </ActionButton>
                  <ActionButton
                    label="Stop helper"
                    helpText="Gracefully stops the helper runtime container."
                    disabled={!detail.instance}
                    onClick={() => void runtimeActionMutation.mutateAsync("stop")}
                  >
                    <PauseCircle className="h-4 w-4" />
                  </ActionButton>
                  <ActionButton
                    label="Restart helper"
                    helpText="Restarts the helper runtime to apply fresh state without deleting it."
                    disabled={!detail.instance}
                    onClick={() => void runtimeActionMutation.mutateAsync("restart")}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </ActionButton>
                  <ActionButton
                    label="Sync state"
                    helpText="Reconciles stored helper status with the actual container state."
                    disabled={!detail.instance}
                    onClick={() => void runtimeActionMutation.mutateAsync("sync")}
                  >
                    <Activity className="h-4 w-4" />
                  </ActionButton>
                  <ActionButton
                    label="Run repair"
                    helpText="Runs automated recovery steps for unhealthy or inconsistent runtime state."
                    disabled={!detail.instance}
                    onClick={() => void runtimeActionMutation.mutateAsync("repair")}
                  >
                    <Wrench className="h-4 w-4" />
                  </ActionButton>
                </ActionGroup>
                <ActionGroup className="border-destructive/20 bg-destructive/5">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    disabled={!detail.instance}
                    onClick={() => {
                      if (!window.confirm(`Delete helper ${detail.agent?.name || detail.instance?.id}?`)) return;
                      void runtimeActionMutation.mutateAsync("delete");
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </ActionGroup>
              </ActionBar>
            </CardContent>
          </Card>

          <RuntimeMiniCard title="Engine details" description="Runtime image, network, and endpoint details.">
              <KeyValueGrid columns="two">
                <InfoRow label="Engine type" value={selectedRuntime?.label || liveInstance?.runtimeType || "Unknown"} />
                <InfoRow label="Container" value={liveInstance?.containerName || "Unknown"} />
                <InfoRow label="Base URL" value={liveInstance?.baseUrl || "Not exposed"} />
                <InfoRow label="Gateway port" value={liveInstance ? String(liveInstance.gatewayPort) : "Unknown"} />
                <InfoRow
                  label="Needs connection code"
                  value={selectedRuntime?.capabilities.pairingAction ? (liveInstance?.requirePairing ? "Yes" : "No") : "Not supported"}
                />
                <InfoRow label="Saved secret settings" value={liveInstance?.hasRuntimeSecrets ? "Stored" : "None"} />
              </KeyValueGrid>
          </RuntimeMiniCard>

          <RuntimeMiniCard title="Workspace details" description="Helper and workspace identifiers.">
              <KeyValueGrid columns="two">
                <InfoRow label="Agent ID" value={detail.agent.id} />
                <InfoRow label="Workspace ID" value={detail.agent.tenantId} />
                <InfoRow label="Workspace" value={detail.tenant?.name || "Unknown"} />
                <InfoRow label="Events recorded" value={String(eventsQuery.data?.length ?? 0)} />
              </KeyValueGrid>
          </RuntimeMiniCard>

          <RuntimeMiniCard title="Current state" description="Latest saved runtime state for this helper.">
            <div className="space-y-4">
              <Button
                variant="outline"
                className="gap-2"
                disabled={!detail.instance || runtimeInstanceQuery.isFetching}
                onClick={() => void runtimeInstanceQuery.refetch()}
              >
                {runtimeInstanceQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh state
              </Button>
              <KeyValueGrid columns="two">
                <InfoRow label="Helper session ID" value={liveInstance?.id || "Not started"} />
                <InfoRow label="Status" value={liveInstance?.status || "Unknown"} />
                <InfoRow label="Updated" value={liveInstance ? formatRelativeDate(liveInstance.updatedAt) : "Unknown"} />
                <InfoRow label="Network" value={liveInstance?.networkName || "Unknown"} />
              </KeyValueGrid>
            </div>
          </RuntimeMiniCard>

          <RuntimeMiniCard title="Health details" description="Container diagnostics and health probe details.">
            <div className="space-y-4">
              <Button
                variant="outline"
                className="gap-2"
                disabled={!detail.instance || diagnosticsQuery.isFetching}
                onClick={() => void diagnosticsQuery.refetch()}
              >
                {diagnosticsQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh health details
              </Button>
              <pre className="max-h-80 overflow-auto rounded-3xl border border-border/70 bg-muted/40 p-4 text-xs leading-6 text-muted-foreground">
                {diagnosticsOutput || "Health details will appear here."}
              </pre>
            </div>
          </RuntimeMiniCard>

          <RuntimeMiniCard
            title="Trace inspector"
            description="Per-chat execution traces captured at the runtime transport boundary."
          >
            <RuntimeTracePanel
              runs={traceRunsQuery.data ?? []}
              selectedTraceId={selectedTraceId}
              selectedTrace={traceDetailQuery.data}
              listLoading={traceRunsQuery.isLoading}
              detailLoading={traceDetailQuery.isLoading}
              exportPending={exportTraceMutation.isPending}
              onSelectTrace={setSelectedTraceId}
              onExportTrace={(traceId) => void exportTraceMutation.mutateAsync(traceId)}
            />
          </RuntimeMiniCard>

          <RuntimeMiniCard
            title="Runtime and container logs"
            description="Recent runtime events and latest container output."
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">Runtime logs</p>
                <pre className="max-h-80 overflow-auto rounded-3xl border border-border/70 bg-muted/40 p-4 text-xs leading-6 text-muted-foreground">
                  {runtimeEventLog || "No runtime events have been recorded yet."}
                </pre>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Container logs</p>
                <pre className="max-h-80 overflow-auto rounded-3xl border border-border/70 bg-muted/40 p-4 text-xs leading-6 text-muted-foreground">
                  {containerLogExcerpt || "Container logs are not available yet."}
                </pre>
              </div>
            </div>
          </RuntimeMiniCard>

          <RuntimeMiniCard title="Activity history" description="Recent activity plus export options.">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={!detail.instance || exportEventsMutation.isPending}
                  onClick={() => void exportEventsMutation.mutateAsync("instance")}
                >
                  {exportEventsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Export this helper
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={exportEventsMutation.isPending}
                  onClick={() => void exportEventsMutation.mutateAsync("org")}
                >
                  {exportEventsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Export all helpers
                </Button>
              </div>
              <ScrollArea className="h-64 rounded-3xl border border-border/70 bg-background/70 p-4">
                <div className="space-y-3">
                  {(eventsQuery.data ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No activity yet.</p>
                  ) : (
                    (eventsQuery.data ?? []).map((event) => (
                      <div key={event.id} className="rounded-2xl border border-border/60 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium capitalize">{formatEventActionLabel(event.action)}</p>
                          <span className="text-xs text-muted-foreground">{formatRelativeDate(event.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{event.message || event.outcome}</p>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </RuntimeMiniCard>
            </TabsContent>

            <TabsContent value="shared-files" className="mt-0 space-y-4">
          {detail.instance ? (
            <SharedFilesPanel instanceId={detail.instance.id} helperName={detail.agent.name} />
          ) : (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Start this helper to manage shared files.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="overview" className="mt-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Helper Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AgentAvatarField
                avatar={agentAvatar}
                helperName={agentName}
                onRandomize={() => setAgentAvatar(createRandomAgentAvatar())}
                onRemove={() => setAgentAvatar(undefined)}
              />
              <div className="grid gap-4 lg:grid-cols-2">
                <LabeledField label="Helper name">
                  <Input value={agentName} onChange={(event) => setAgentName(event.target.value)} />
                </LabeledField>
                <LabeledField label="Helper style (optional)">
                  <Textarea
                    value={agentRoleTitle}
                    onChange={(event) => setAgentRoleTitle(event.target.value)}
                    rows={3}
                    placeholder="Optional guidance that shapes how the helper introduces itself and works."
                  />
                </LabeledField>
              </div>
              <Button
                className="gap-2"
                disabled={agentMutation.isPending || !detail.agent || agentName.trim().length < 2}
                onClick={() => void agentMutation.mutateAsync()}
              >
                {agentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Save helper profile
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Engine type" value={selectedRuntime?.label || liveInstance?.runtimeType || "Not started"} />
            <MetricCard label="Integrations" value={formatIntegrationMetricValue(enabledIntegrations)} />
            <MetricCard label="Latest event" value={formatEventActionLabel(detail.latestEvent?.action)} />
          </div>

          {detail.agent.presetId ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Preset profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <KeyValueGrid columns="two">
                  <InfoRow label="Preset" value={detail.agent.presetName || detail.agent.presetId} />
                </KeyValueGrid>
                <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                  {detail.agent.presetSummary || "This helper was created from a curated preset."}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {runtimeCatalogQuery.isError ? (
            <Card>
              <CardContent className="p-6 text-sm text-destructive">
                Engine list unavailable. These settings cannot be loaded right now.
              </CardContent>
            </Card>
          ) : null}

          {supportsLlmConfig ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">AI Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <LabeledField label="AI model">
                  <ModelPickerField
                    value={llmModel}
                    fallbackLabel={detail.instance?.llmModel || "Choose a model"}
                    items={modelCatalogItems}
                    onChange={setLlmModel}
                    statusText={modelCatalogStatusText}
                  />
                </LabeledField>
                <LabeledField label="API key">
                  <Input
                    type="password"
                    value={llmApiKey}
                    onChange={(event) => setLlmApiKey(event.target.value)}
                    placeholder={detail.instance?.hasLlmApiKey ? "Leave blank to keep the saved key" : "Enter API key"}
                  />
                </LabeledField>
                <Button className="gap-2" disabled={llmMutation.isPending || !detail.instance} onClick={() => void llmMutation.mutateAsync()}>
                  {llmMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Save AI settings
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {supportsRuntimeConfig ? (
            <Card>
              <CardHeader>
              <CardTitle className="text-lg">Engine settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <RuntimeConfigFields
                  fields={selectedRuntime?.runtimeConfigFields ?? []}
                  values={runtimeConfigValues}
                  secretPlaceholder={
                    detail.instance?.hasRuntimeSecrets
                      ? "Leave blank to keep the current saved secrets"
                      : undefined
                  }
                  onChange={(key, value) =>
                    setRuntimeConfigValues((current) => ({ ...current, [key]: value }))
                  }
                />
                {detail.instance?.hasRuntimeSecrets ? (
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-xs text-muted-foreground">
                    Leaving secret fields blank keeps the current saved secrets. Entering new values replaces the saved secrets with what you enter here.
                  </div>
                ) : null}
                <Button className="gap-2" disabled={runtimeConfigMutation.isPending || !detail.instance} onClick={() => void runtimeConfigMutation.mutateAsync()}>
                  {runtimeConfigMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Save engine settings
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {!supportsLlmConfig && !supportsRuntimeConfig ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                This engine does not have extra editable settings right now.
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

            <TabsContent value="channels" className="mt-0 space-y-6">
          <div className="grid gap-4 xl:grid-cols-2">
              {supportsTelegramConfig ? (
                <TelegramIntegrationCard
                  enabled={telegramEnabled}
                  onEnabledChange={setTelegramEnabled}
                  summary={
                    detail.instance?.hasTelegramBotToken
                      ? "Disabled. A Telegram bot token is already stored for this helper."
                      : "Disabled. Turn on Telegram to configure bot access."
                  }
                  saveLabel="Save Telegram settings"
                  saveDisabled={telegramMutation.isPending || !detail.instance}
                  saveIcon={telegramMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  onSave={() => void telegramMutation.mutateAsync()}
                  tokenField={
                    selectedRuntime?.capabilities.telegramToken
                      ? {
                          value: telegramToken,
                          onChange: setTelegramToken,
                          placeholder: detail.instance?.hasTelegramBotToken
                            ? "Leave blank to keep the saved token"
                            : "123456789:ABC...",
                        }
                      : undefined
                  }
                  allowListValue={
                    selectedRuntime?.capabilities.telegramAllowFrom ? telegramAllowList : undefined
                  }
                  onAllowListChange={
                    selectedRuntime?.capabilities.telegramAllowFrom ? setTelegramAllowList : undefined
                  }
                  allowListWarnings={
                    selectedRuntime?.capabilities.telegramAllowFrom
                      ? parseTelegramAllowListInput(telegramAllowList).warnings
                      : []
                  }
                  showReplyInPrivate={selectedRuntime?.capabilities.telegramReplyInPrivate}
                  replyInPrivate={replyInPrivate}
                  onReplyInPrivateChange={setReplyInPrivate}
                />
              ) : null}

              <SlackIntegrationCard
                enabled={slackEnabled}
                onEnabledChange={setSlackEnabled}
                summary={
                  detail.instance?.hasSlackBotToken
                    ? "Slack is disabled. Credentials are already stored and can be updated below before re-enabling."
                    : "Slack is disabled. Add bot credentials below, then enable Slack when ready."
                }
                saveLabel="Save Slack settings"
                saveDisabled={slackMutation.isPending || !detail.instance}
                saveIcon={slackMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                onSave={() => void slackMutation.mutateAsync()}
                alwaysVisibleContent={
                  <SlackOnboardingPanel
                    onboarding={slackOnboardingQuery.data}
                    onboardingLoading={slackOnboardingQuery.isLoading}
                    checkResult={slackOnboardingCheckResult}
                    checkPending={slackOnboardingCheckMutation.isPending}
                    hasUnsavedChanges={slackHasUnsavedChanges}
                    onRunCheck={() => void slackOnboardingCheckMutation.mutateAsync()}
                  />
                }
                botToken={slackBotToken}
                onBotTokenChange={setSlackBotToken}
                botTokenPlaceholder={
                  detail.instance?.hasSlackBotToken ? "Leave blank to keep the saved token" : "xoxb-..."
                }
                appToken={slackAppToken}
                onAppTokenChange={setSlackAppToken}
                appTokenPlaceholder={
                  detail.instance?.hasSlackAppToken ? "Leave blank to keep the saved app token" : "xapp-..."
                }
                allowedChannelIds={slackAllowedChannelIds}
                onAllowedChannelIdsChange={setSlackAllowedChannelIds}
                allowedUserIds={slackAllowedUserIds}
                onAllowedUserIdsChange={setSlackAllowedUserIds}
                replyInThread={slackReplyInThread}
                onReplyInThreadChange={setSlackReplyInThread}
              />
              <DiscordIntegrationCard
                enabled={discordEnabled}
                onEnabledChange={setDiscordEnabled}
                summary={
                  detail.instance?.hasDiscordBotToken
                    ? "Disabled. A Discord bot token is already stored for this helper."
                    : "Disabled. Turn on Discord to configure the bot token and allowlists."
                }
                saveLabel="Save Discord settings"
                saveDisabled={discordMutation.isPending || !detail.instance}
                saveIcon={discordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                onSave={() => void discordMutation.mutateAsync()}
                botToken={discordBotToken}
                onBotTokenChange={setDiscordBotToken}
                botTokenPlaceholder={
                  detail.instance?.hasDiscordBotToken
                    ? "Leave blank to keep the saved token"
                    : "Discord bot token"
                }
                allowedUserIds={discordAllowedUserIds}
                onAllowedUserIdsChange={setDiscordAllowedUserIds}
                showAllowedUserIds={selectedRuntime?.capabilities.discordAllowedUserIds}
                allowedGuildIds={discordAllowedGuildIds}
                onAllowedGuildIdsChange={setDiscordAllowedGuildIds}
                showAllowedGuildIds={selectedRuntime?.capabilities.discordAllowedGuildIds}
                allowedChannelIds={discordAllowedChannelIds}
                onAllowedChannelIdsChange={setDiscordAllowedChannelIds}
                showAllowedChannelIds={selectedRuntime?.capabilities.discordAllowedChannelIds}
                replyInThread={discordReplyInThread}
                onReplyInThreadChange={setDiscordReplyInThread}
                showReplyInThread={selectedRuntime?.capabilities.discordReplyInThread}
                replyBehaviorTitle={
                  selectedRuntime?.capabilities.discordAllowedUserIds &&
                  selectedRuntime?.capabilities.discordAllowedGuildIds !== true
                    ? "Auto thread"
                    : "Reply in thread"
                }
                replyBehaviorDescription={
                  selectedRuntime?.capabilities.discordAllowedUserIds &&
                  selectedRuntime?.capabilities.discordAllowedGuildIds !== true
                    ? "Create a fresh thread when the helper is mentioned."
                    : "Send Discord replies as message replies."
                }
                requireMention={discordRequireMention}
                onRequireMentionChange={setDiscordRequireMention}
                showRequireMention={selectedRuntime?.capabilities.discordRequireMention}
              />
            </div>

          {supportsPairing ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Connection code and access key</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm">
                  <p className="font-medium">Saved access key</p>
                  <p className="mt-1 text-muted-foreground">{detail.instance?.hasToken ? "An access key is saved." : "No access key has been saved yet."}</p>
                  {pairingInfoQuery.data?.pairingCode ? (
                    <p className="mt-2 text-muted-foreground">Suggested connection code: {pairingInfoQuery.data.pairingCode}</p>
                  ) : null}
                </div>
                {selectedRuntime?.capabilities.pairingAction ? (
                  <>
                    <LabeledField label="Connection code">
                      <Input value={pairingCode} onChange={(event) => setPairingCode(event.target.value)} placeholder="Paste the connection code" />
                    </LabeledField>
                    <Button className="gap-2" disabled={pairMutation.isPending || !detail.instance || !pairingCode.trim()} onClick={() => void pairMutation.mutateAsync()}>
                      {pairMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Save connection code
                    </Button>
                  </>
                ) : null}
                <LabeledField label="Access key">
                  <Input value={runtimeToken} onChange={(event) => setRuntimeToken(event.target.value)} placeholder="Paste an access key to save manually" />
                </LabeledField>
                <Button variant="outline" className="gap-2" disabled={tokenMutation.isPending || !detail.instance || !runtimeToken.trim()} onClick={() => void tokenMutation.mutateAsync()}>
                  {tokenMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Save access key
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {supportsWebhook ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test message</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <LabeledField label="Message">
                  <Textarea value={webhookMessage} onChange={(event) => setWebhookMessage(event.target.value)} rows={4} />
                </LabeledField>
                <LabeledField label="Optional access key">
                  <Input value={webhookToken} onChange={(event) => setWebhookToken(event.target.value)} placeholder="Leave blank to use the saved key" />
                </LabeledField>
                <Button className="gap-2" disabled={webhookMutation.isPending || !detail.instance || !webhookMessage.trim()} onClick={() => void webhookMutation.mutateAsync()}>
                  {webhookMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send test message
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {!supportsTelegramConfig && !supportsPairing && !supportsWebhook ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                This engine does not support connection controls here.
              </CardContent>
            </Card>
          ) : null}
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </PageContainer>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function formatIntegrationMetricValue(enabledIntegrations: string[]): string {
  if (enabledIntegrations.length === 0) {
    return "Disabled";
  }

  return enabledIntegrations.length === 1 ? "1 enabled" : `${enabledIntegrations.length} enabled`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <KeyValueItem label={label} value={value} />;
}

function ActionButton({
  label,
  helpText,
  disabled,
  onClick,
  children,
}: {
  label: string;
  helpText?: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs" disabled={disabled} onClick={onClick}>
        {children}
        {label}
      </Button>
      {helpText ? (
        <span className="inline-flex" aria-label={`${label} details`} title={helpText}>
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
      ) : null}
    </div>
  );
}

function AgentChatBubble({ message }: { message: RuntimeChatMessage }) {
  const isUser = message.role === "user";
  const isError = message.role === "error";
  const bubbleClassName = isError
    ? "border-destructive/30 bg-destructive/5"
    : isUser
      ? "bg-primary text-primary-foreground"
      : "border-border/70 bg-muted/30";
  const wrapperClassName = isUser ? "justify-end" : "justify-start";
  const timestampClassName = isUser
    ? "text-primary-foreground/70"
    : "text-muted-foreground";

  return (
    <div className={cn("flex", wrapperClassName)}>
      <div className={cn("max-w-[78%] rounded-[22px] border px-4 py-3", bubbleClassName)}>
        <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
        <p className={cn("mt-2 text-[11px]", timestampClassName)}>
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
        <Link to={`/agents/${agentId}?tab=runtime`}>
          <Button variant="outline" className="rounded-2xl">
            Review helper settings
          </Button>
        </Link>
        <Link to={`/agents/${agentId}?tab=channels`}>
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
  instance: { status: string; baseUrl?: string; requirePairing: boolean; hasToken: boolean; agentId: string } | undefined,
  runtime: { capabilities: { chatAction?: boolean } } | undefined
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
      actionHref: `/agents/${instance.agentId}?tab=runtime`,
    };
  }
  if (!instance.baseUrl?.trim()) {
    return {
      title: "Runtime endpoint unavailable",
      body: "Atoll does not have a published runtime endpoint for this helper yet. Re-start or repair the helper, then try again.",
      actionLabel: "Open settings",
      actionHref: `/agents/${instance.agentId}?tab=runtime`,
    };
  }
  if (instance.requirePairing && !instance.hasToken) {
    return {
      title: "Token or pairing required",
      body: "Finish pairing or save an access key in helper settings before using chat.",
      actionLabel: "Open settings",
      actionHref: `/agents/${instance.agentId}?tab=runtime`,
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

function mergeChatMessages(existing: RuntimeChatMessage[], incoming: RuntimeChatMessage[]) {
  const byId = new Map<string, RuntimeChatMessage>();
  for (const message of [...existing, ...incoming]) {
    byId.set(message.id, message);
  }
  return [...byId.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function RuntimeMiniCard({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <details open={defaultOpen}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4">
          <div>
            <p className="text-lg font-semibold">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </summary>
        <div className="border-t border-border/70 px-6 py-4">{children}</div>
      </details>
    </Card>
  );
}

function SlackOnboardingPanel({
  onboarding,
  onboardingLoading,
  checkResult,
  checkPending,
  hasUnsavedChanges,
  onRunCheck,
}: {
  onboarding?: RuntimeSlackOnboarding;
  onboardingLoading: boolean;
  checkResult?: RuntimeSlackOnboardingCheckResponse;
  checkPending: boolean;
  hasUnsavedChanges: boolean;
  onRunCheck: () => void;
}) {
  const missingItems = checkResult ? toSlackSetupMissingGuidance(checkResult.missing) : [];

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-background/70 p-4">
      <div>
        <p className="font-medium">Slack onboarding guide</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Follow these steps to connect Slack Socket Mode. The bot token and app token fields are in the Slack card above.
        </p>
      </div>

      <div className="rounded-2xl border border-border/70 bg-background/70 p-3 text-sm">
        <p className="font-medium">Quick setup</p>
        <p className="mt-1 text-muted-foreground">
          This helper uses native Slack Socket Mode. Required credentials are bot token (`xoxb-...`) and app token (`xapp-...`).
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Create or open your Slack app and enable Socket Mode.</li>
          <li>Create an app-level token with `connections:write` and save it as App token (`xapp-...`).</li>
          <li>From OAuth &amp; Permissions, copy Bot User OAuth Token (`xoxb-...`) into Bot token.</li>
          <li>
            Keep bot scopes at least: `app_mentions:read`, `chat:write`, `im:history`, `channels:read`,
            `groups:read`, `mpim:read`, `im:read`, `users:read`.
          </li>
          <li>If you plan to use DMs, keep App Home &rarr; Messages Tab enabled.</li>
          <li>Click <span className="font-medium text-foreground">Save Slack settings</span>, then click <span className="font-medium text-foreground">Run setup check</span>.</li>
        </ol>
      </div>

      <details className="rounded-2xl border border-border/70 bg-background/70 p-3">
        <summary className="cursor-pointer text-sm font-medium">Setup checklist</summary>
        <div className="mt-3 space-y-2 text-sm">
          {(onboarding?.checklist ?? []).map((item) => (
            <div key={item.id} className="rounded-xl border border-border/60 px-3 py-2">
              <p className="font-medium">{item.done ? "Done" : "Pending"} · {item.title}</p>
              {item.hint ? <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p> : null}
            </div>
          ))}
          {!onboarding?.checklist?.length && !onboardingLoading ? (
            <p className="text-xs text-muted-foreground">Checklist is unavailable.</p>
          ) : null}
        </div>
      </details>

      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" className="gap-2" disabled={checkPending || hasUnsavedChanges} onClick={onRunCheck}>
          {checkPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Run setup check
        </Button>
      </div>
      {hasUnsavedChanges ? (
        <p className="text-xs text-muted-foreground">
          You have unsaved Slack changes. Save Slack settings first, then run setup check.
        </p>
      ) : null}

      {checkResult ? (
        <div className="rounded-2xl border border-border/70 bg-background/70 p-3 text-sm">
          <p className="font-medium">
            Setup check: {checkResult.status === "ready" ? "Ready" : "Needs config"}
          </p>
          <p className="mt-1 text-muted-foreground">{checkResult.message}</p>
          {missingItems.length > 0 ? (
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              {missingItems.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SharedFilesPanel({ instanceId, helperName }: { instanceId: string; helperName: string }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [deletingFolderPath, setDeletingFolderPath] = useState<string | null>(null);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const sharedFilesQuery = useQuery({
    queryKey: ["runtime-shared-files", instanceId],
    queryFn: () => listRuntimeSharedFiles(instanceId),
  });
  const filteredFiles = useMemo(() => {
    const files = sharedFilesQuery.data ?? [];
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return files;
    }
    return files.filter((file) => file.relativePath.toLowerCase().includes(query));
  }, [searchValue, sharedFilesQuery.data]);
  const filteredFileTree = useMemo(() => buildRuntimeSharedFileTree(filteredFiles), [filteredFiles]);

  useEffect(() => {
    const input = folderInputRef.current;
    if (!input) {
      return;
    }
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
  }, []);

  const uploadMutation = useMutation({
    mutationFn: async (files: RuntimeSharedFileUploadInput[]) => uploadRuntimeSharedFiles(instanceId, files),
  });

  const deleteMutation = useMutation({
    mutationFn: async (file: RuntimeSharedFile) => {
      setDeletingFileId(file.id);
      await deleteRuntimeSharedFile(instanceId, file.relativePath);
    },
    onSuccess: async () => {
      toast.success("Shared file deleted");
      await queryClient.invalidateQueries({ queryKey: ["runtime-shared-files", instanceId] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Could not delete the shared file"));
    },
    onSettled: () => {
      setDeletingFileId(null);
    },
  });

  const handleFiles = async (files: RuntimeSharedFileUploadInput[]) => {
    if (files.length === 0) {
      return;
    }
    const batches = chunkRuntimeSharedUploadItems(files);
    try {
      let uploadedCount = 0;
      for (const batch of batches) {
        await uploadMutation.mutateAsync(batch);
        uploadedCount += batch.length;
      }
      toast.success(uploadedCount === 1 ? "Shared file uploaded" : "Shared files uploaded");
      await queryClient.invalidateQueries({ queryKey: ["runtime-shared-files", instanceId] });
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not upload shared files"));
    }
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = normalizeRuntimeSharedUploadItemsFromFileList(event.target.files ?? []);
    event.target.value = "";
    void handleFiles(files);
  };

  const handleFolderInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = normalizeRuntimeSharedUploadItemsFromFileList(event.target.files ?? []);
    event.target.value = "";
    void handleFiles(files);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    const files = await extractRuntimeSharedUploadItemsFromDataTransfer(event.dataTransfer);
    await handleFiles(files);
  };

  const handleDownload = async (file: RuntimeSharedFile) => {
    setDownloadingFileId(file.id);
    try {
      const blob = await downloadRuntimeSharedFile(instanceId, file.relativePath);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not download the shared file"));
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handleDeleteFolder = async (folderPath: string) => {
    const allFiles = sharedFilesQuery.data ?? [];
    const filesInFolder = listRuntimeSharedFilesInFolder(allFiles, folderPath);
    if (filesInFolder.length === 0) {
      toast.error("Folder is empty");
      return;
    }

    const deleteConfirmed =
      typeof window === "undefined"
        ? true
        : window.confirm(
            `Delete folder "${folderPath}" and ${filesInFolder.length} file${filesInFolder.length === 1 ? "" : "s"}?`
          );
    if (!deleteConfirmed) {
      return;
    }

    setDeletingFolderPath(folderPath);
    try {
      for (const file of filesInFolder) {
        await deleteRuntimeSharedFile(instanceId, file.relativePath);
      }
      toast.success(
        filesInFolder.length === 1
          ? "Folder deleted (1 file removed)"
          : `Folder deleted (${filesInFolder.length} files removed)`
      );
      await queryClient.invalidateQueries({ queryKey: ["runtime-shared-files", instanceId] });
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not delete the folder"));
    } finally {
      setDeletingFolderPath(null);
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFolderInputChange}
      />

      <Card>
        <CardHeader className="gap-4 border-b border-border/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">Upload Files</CardTitle>
              <p className="text-sm text-muted-foreground">
                Keep shared files with {helperName} here. Files stay with the helper across restarts and keep their folder paths.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <div className="relative min-w-[16rem] flex-1 lg:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search files"
                  className="pl-9"
                />
              </div>
              <Button
                type="button"
                className="gap-2"
                disabled={uploadMutation.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
                Choose files
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={uploadMutation.isPending}
                onClick={() => folderInputRef.current?.click()}
              >
                {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
                Choose folder
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div
            className={cn(
              "rounded-3xl border border-dashed px-5 py-6 transition-colors",
              isDragActive ? "border-primary bg-primary/5" : "border-border/70 bg-muted/25"
            )}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragActive(false);
            }}
            onDrop={handleDrop}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="font-medium">Drag files or folders here, or choose them from disk</p>
              </div>
            </div>
          </div>

          {sharedFilesQuery.isLoading ? (
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
              Loading shared files…
            </div>
          ) : null}

          {sharedFilesQuery.isError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {getErrorMessage(sharedFilesQuery.error, "Could not load shared files")}
            </div>
          ) : null}

          {!sharedFilesQuery.isLoading && !sharedFilesQuery.isError ? (
            <div className="space-y-3">
              {filteredFiles.length ? (
                <RuntimeSharedFilesTree
                  root={filteredFileTree}
                  deletingFileId={deletingFileId}
                  deletingFolderPath={deletingFolderPath}
                  downloadingFileId={downloadingFileId}
                  onDownload={handleDownload}
                  onDelete={(file) => void deleteMutation.mutateAsync(file)}
                  onDeleteFolder={(folderPath) => void handleDeleteFolder(folderPath)}
                />
              ) : sharedFilesQuery.data?.length ? (
                <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
                  No files match this search.
                </div>
              ) : (
                <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
                  No shared files yet.
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function RuntimeSharedFilesTree({
  root,
  deletingFileId,
  deletingFolderPath,
  downloadingFileId,
  onDownload,
  onDelete,
  onDeleteFolder,
}: {
  root: RuntimeSharedFileTreeNode;
  deletingFileId: string | null;
  deletingFolderPath: string | null;
  downloadingFileId: string | null;
  onDownload: (file: RuntimeSharedFile) => Promise<void> | void;
  onDelete: (file: RuntimeSharedFile) => void;
  onDeleteFolder: (folderPath: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
      <RuntimeSharedFilesTreeNode
        node={root}
        deletingFileId={deletingFileId}
        deletingFolderPath={deletingFolderPath}
        downloadingFileId={downloadingFileId}
        onDownload={onDownload}
        onDelete={onDelete}
        onDeleteFolder={onDeleteFolder}
        depth={0}
      />
    </div>
  );
}

function RuntimeSharedFilesTreeNode({
  node,
  deletingFileId,
  deletingFolderPath,
  downloadingFileId,
  onDownload,
  onDelete,
  onDeleteFolder,
  depth,
}: {
  node: RuntimeSharedFileTreeNode;
  deletingFileId: string | null;
  deletingFolderPath: string | null;
  downloadingFileId: string | null;
  onDownload: (file: RuntimeSharedFile) => Promise<void> | void;
  onDelete: (file: RuntimeSharedFile) => void;
  onDeleteFolder: (folderPath: string) => void;
  depth: number;
}) {
  return (
    <div className="space-y-1">
      {node.folders.map((folder) => (
        <details key={folder.path} open>
          <summary
            className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium hover:bg-muted/40"
            style={{ paddingLeft: `${depth * 18 + 8}px` }}
          >
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{folder.name}</span>
            <div className="ml-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={Boolean(deletingFolderPath)}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDeleteFolder(folder.path);
                }}
              >
                {deletingFolderPath === folder.path ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete folder
              </Button>
            </div>
          </summary>
          <div className="space-y-1">
            <RuntimeSharedFilesTreeNode
              node={folder}
              deletingFileId={deletingFileId}
              deletingFolderPath={deletingFolderPath}
              downloadingFileId={downloadingFileId}
              onDownload={onDownload}
              onDelete={onDelete}
              onDeleteFolder={onDeleteFolder}
              depth={depth + 1}
            />
          </div>
        </details>
      ))}
      {node.files.map((file) => (
        <div
          key={file.id}
          className="flex flex-col gap-2 rounded-lg px-2 py-2 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
          style={{ paddingLeft: `${depth * 18 + 8}px` }}
        >
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="truncate text-sm font-medium">{file.name}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatFileSize(file.sizeBytes)} · Added {formatRelativeDate(file.uploadedAt)}
            </p>
            <p className="truncate text-xs text-muted-foreground">{file.relativePath}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={downloadingFileId === file.id || Boolean(deletingFolderPath)}
              onClick={() => void onDownload(file)}
            >
              {downloadingFileId === file.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={deletingFileId === file.id || Boolean(deletingFolderPath)}
              onClick={() => onDelete(file)}
            >
              {deletingFileId === file.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  for (let index = 0; index < sortedLeft.length; index += 1) {
    if (sortedLeft[index] !== sortedRight[index]) {
      return false;
    }
  }
  return true;
}

function toSlackSetupMissingGuidance(missing: string[]): string[] {
  return missing.map((item) => {
    switch (item) {
      case "slack_enabled":
        return "Enable Slack for this helper.";
      case "slack_bot_token":
        return "Add the Slack bot token (`xoxb-...`) and save settings.";
      case "slack_app_token":
        return "Add the Slack app token (`xapp-...`) and save settings.";
      default:
        return item;
    }
  });
}

function formatFileSize(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 1024) {
    return `${Math.max(0, Math.round(sizeBytes))} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseAgentSettingsTab(value: string | null): AgentSettingsTab | undefined {
  if (
    value === "overview" ||
    value === "skills" ||
    value === "runtime" ||
    value === "shared-files" ||
    value === "channels"
  ) {
    return value;
  }
  return undefined;
}
