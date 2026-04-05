import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Images, Loader2, MessageSquareText, Rocket, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AgentAvatarField } from "@/components/AgentAvatarField";
import {
  DiscordIntegrationCard,
  SetupSlackGuidePanel,
  SlackIntegrationCard,
  TelegramIntegrationCard,
} from "@/components/HelperChannelIntegrations";
import { LabeledField } from "@/components/LabeledField";
import { ModelPickerField } from "@/components/ModelPickerField";
import { RuntimeConfigFields } from "@/components/RuntimeConfigFields";
import { FormSection } from "@/components/layout/FormSection";
import { KeyValueItem } from "@/components/layout/KeyValueGrid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createAgent,
  createProvisionJob,
  createTenant,
  getErrorMessage,
  getHealth,
  getModelCatalog,
  getProvisionJob,
  listAgentPresets,
  listRuntimeCatalog,
  listTenants,
  type AgentPreset,
  type RuntimeCatalogItem,
  type Tenant,
} from "@/lib/api";
import { createRandomAgentAvatar } from "@/lib/agent-avatar";
import {
  buildInitialProvisionWizardState,
  getVisibleRuntimeCatalog,
  parseIntegrationIdListInput,
  parseTelegramAllowListInput,
  resolvePreferredRuntime,
  type ProvisionWizardState,
} from "@/lib/models";
import {
  buildSecretQueryFingerprint,
  DEFAULT_LLM_PROVIDER,
  FALLBACK_MODEL_ITEMS,
} from "@/lib/model-catalog";
import { ONBOARDING_COPY } from "@/lib/onboarding";
import {
  buildRuntimeConfigFormState,
  parseRuntimeConfigFormState,
  type RuntimeConfigFormState,
} from "@/lib/runtime-config";
import { useOnboarding } from "@/hooks/use-onboarding";

const CUSTOM_PRESET_VALUE = "__custom__";
const DEFAULT_WORKSPACE_NAME = "Default Workspace";

type WizardStepId = "details" | "runtime" | "connections" | "review";

const STEPS: Array<{ id: WizardStepId; title: string; subtitle: string }> = [
  {
    id: "details",
    title: "Setup your helper",
    subtitle: "Set up your helper your ideal co-worker.",
  },
  {
    id: "runtime",
    title: "Choose your setup",
    subtitle: "Choose your helper's engine and LLM settings.",
  },
  {
    id: "connections",
    title: "Connect to channels",
    subtitle: "Connect your helper to messaging platforms and access it from anywhere.",
  },
  {
    id: "review",
    title: "Final review",
    subtitle: "Review your settings, click Launch, and start talking to your new helper.",
  },
];

type ProvisionJobSnapshot = Awaited<ReturnType<typeof getProvisionJob>>;

export default function AgentSetup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isOnboardingMode = searchParams.get("mode") === "onboarding";
  const queryClient = useQueryClient();
  const { markHelperCreated } = useOnboarding();
  const healthQuery = useQuery({ queryKey: ["health"], queryFn: getHealth });
  const runtimeCatalogQuery = useQuery({ queryKey: ["runtime-catalog"], queryFn: listRuntimeCatalog });
  const presetsQuery = useQuery({ queryKey: ["agent-presets"], queryFn: listAgentPresets });
  const tenantsQuery = useQuery({ queryKey: ["tenants"], queryFn: listTenants });
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ProvisionWizardState>(buildInitialProvisionWizardState());
  const [jobStatus, setJobStatus] = useState("");
  const [jobError, setJobError] = useState("");
  const [useDedicatedLlmApiKey, setUseDedicatedLlmApiKey] = useState(false);
  const [showAdvancedSetup, setShowAdvancedSetup] = useState(() => !isOnboardingMode);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const runtimeCatalog = useMemo(
    () => getVisibleRuntimeCatalog(runtimeCatalogQuery.data ?? []),
    [runtimeCatalogQuery.data]
  );
  const workspaces = useMemo(() => tenantsQuery.data ?? [], [tenantsQuery.data]);
  const defaultWorkspace = useMemo(
    () => workspaces.find((tenant) => tenant.isDefault) ?? undefined,
    [workspaces]
  );
  const dedicatedWorkspaces = useMemo(
    () => workspaces.filter((tenant) => tenant.kind === "dedicated" && !tenant.isDefault),
    [workspaces]
  );
  const selectedWorkspace = useMemo(() => {
    if (form.workspaceChoice === "default") {
      return defaultWorkspace;
    }
    return workspaces.find((tenant) => tenant.id === form.selectedTenantId);
  }, [defaultWorkspace, form.selectedTenantId, form.workspaceChoice, workspaces]);
  const selectedRuntime = resolvePreferredRuntime(runtimeCatalog, form.runtimeType);
  const presets = presetsQuery.data ?? [];
  const currentPreset = presets.find((preset) => preset.id === form.presetId);
  const identitySkills = useMemo(
    () => currentPreset?.recommendedSkills ?? [],
    [currentPreset]
  );
  const workspaceSummary = useMemo(
    () => describeWorkspaceSelection(form, defaultWorkspace, dedicatedWorkspaces),
    [dedicatedWorkspaces, defaultWorkspace, form]
  );

  useEffect(() => {
    if (!healthQuery.data && runtimeCatalog.length === 0) {
      return;
    }

    setForm((current) => {
      const preferredRuntime = resolvePreferredRuntime(
        runtimeCatalog,
        runtimeCatalog.some((item) => item.id === current.runtimeType)
          ? current.runtimeType
          : healthQuery.data?.runtime.defaultRuntimeType
      );

      if (!preferredRuntime) {
        return current;
      }

      return applyRuntimeSelection(
        {
          ...current,
          llmProvider: DEFAULT_LLM_PROVIDER,
          llmModel: current.llmModel || healthQuery.data?.runtime.defaultModel || "",
        },
        preferredRuntime
      );
    });
  }, [healthQuery.data, runtimeCatalog]);

  useEffect(() => {
    setForm((current) => {
      if (current.workspaceChoice === "default") {
        if (!defaultWorkspace) {
          return current;
        }

        if (
          current.selectedTenantId === defaultWorkspace.id &&
          current.tenantName === defaultWorkspace.name
        ) {
          return current;
        }

        return {
          ...current,
          selectedTenantId: defaultWorkspace.id,
          tenantName: defaultWorkspace.name,
        };
      }

      if (current.workspaceChoice !== "join") {
        return current;
      }

      if (dedicatedWorkspaces.length === 0) {
        return current.selectedTenantId
          ? {
              ...current,
              selectedTenantId: "",
            }
          : current;
      }

      const hasSelectedWorkspace = dedicatedWorkspaces.some((tenant) => tenant.id === current.selectedTenantId);
      if (hasSelectedWorkspace) {
        return current;
      }

      return {
        ...current,
        selectedTenantId: dedicatedWorkspaces[0]?.id ?? "",
      };
    });
  }, [dedicatedWorkspaces, defaultWorkspace]);

  const hasServerDefaultLlmApiKey = Boolean(healthQuery.data?.runtime.hasApiKey);
  const activeSteps = useMemo(
    () => STEPS.filter((item) => item.id !== "connections" || form.configureIntegrations),
    [form.configureIntegrations]
  );
  const currentStep = activeSteps[step] ?? activeSteps[activeSteps.length - 1] ?? STEPS[0];
  const currentStepId = currentStep.id;
  const effectiveLlmApiKey = useDedicatedLlmApiKey ? form.llmApiKey : "";

  useEffect(() => {
    if (healthQuery.isSuccess && !hasServerDefaultLlmApiKey) {
      setUseDedicatedLlmApiKey(true);
    }
  }, [hasServerDefaultLlmApiKey, healthQuery.isSuccess]);

  useEffect(() => {
    if (isOnboardingMode) {
      setShowAdvancedSetup(false);
    }
  }, [isOnboardingMode]);

  useEffect(() => {
    setStep((current) => Math.min(current, Math.max(activeSteps.length - 1, 0)));
  }, [activeSteps.length]);

  const modelCatalogQuery = useQuery({
    queryKey: ["model-catalog", DEFAULT_LLM_PROVIDER, buildSecretQueryFingerprint(effectiveLlmApiKey)],
    queryFn: () => getModelCatalog(DEFAULT_LLM_PROVIDER, effectiveLlmApiKey || undefined),
    enabled: true,
    retry: 0,
  });

  const launchMutation = useMutation({
    mutationFn: async () => {
      setJobError("");
      setJobStatus("");

      if (!selectedRuntime) {
        throw new Error("Runtime catalog is unavailable");
      }

      const allowList = selectedRuntime.capabilities.telegramAllowFrom
        ? parseTelegramAllowListInput(form.telegramAllowFrom, { strict: true })
        : { entries: [], invalid: [], warnings: [] };
      const runtimeConfig = parseRuntimeConfigFormState({
        fields: selectedRuntime.runtimeConfigFields,
        values: form.runtimeConfig,
        requireSecretValues: true,
      });
      let tenant: Tenant;
      if (form.workspaceChoice === "create") {
        tenant = await createTenant({ name: form.tenantName.trim(), kind: "dedicated" });
      } else if (form.workspaceChoice === "join") {
        if (!selectedWorkspace || selectedWorkspace.kind !== "dedicated") {
          throw new Error("Select a dedicated workspace before continuing");
        }
        tenant = selectedWorkspace;
      } else {
        tenant =
          defaultWorkspace ??
          (await createTenant({
            name: DEFAULT_WORKSPACE_NAME,
            kind: "default",
          }));
      }
      const agent = await createAgent({
        tenantId: tenant.id,
        name: form.agentName,
        avatar: form.avatar,
        agentType: "general",
        skills: identitySkills,
        roleTitle: form.roleTitle || undefined,
        presetId: form.presetId || undefined,
        channel: "custom",
      });

      setJobStatus("Starting helper setup...");

      const provision = await createProvisionJob({
        tenantId: tenant.id,
        agentId: agent.id,
        runtimeType: selectedRuntime.id,
        llmProvider: DEFAULT_LLM_PROVIDER,
        llmModel: form.llmModel,
        llmApiKey: effectiveLlmApiKey,
        telegramEnabled:
          form.configureIntegrations && supportsTelegramChannelControls(selectedRuntime)
            ? form.telegramEnabled
            : false,
        telegramBotToken:
          !form.configureIntegrations || !selectedRuntime.capabilities.telegramToken
            ? undefined
            : form.telegramBotToken || undefined,
        telegramAllowFrom:
          form.configureIntegrations && selectedRuntime.capabilities.telegramAllowFrom ? allowList.entries : [],
        ...(form.configureIntegrations && selectedRuntime.capabilities.telegramReplyInPrivate
          ? { telegramReplyInPrivate: form.telegramReplyInPrivate }
          : {}),
        slackEnabled: form.configureIntegrations ? form.slackEnabled : false,
        slackBotToken: form.configureIntegrations ? form.slackBotToken || undefined : undefined,
        slackAppToken: form.configureIntegrations ? form.slackAppToken || undefined : undefined,
        slackAllowedChannelIds: form.configureIntegrations
          ? parseIntegrationIdListInput(form.slackAllowedChannelIds)
          : undefined,
        slackAllowedUserIds: form.configureIntegrations
          ? parseIntegrationIdListInput(form.slackAllowedUserIds)
          : undefined,
        slackReplyInThread: form.configureIntegrations ? form.slackReplyInThread : undefined,
        discordEnabled: form.configureIntegrations ? form.discordEnabled : false,
        discordBotToken: form.configureIntegrations ? form.discordBotToken || undefined : undefined,
        discordAllowedGuildIds: form.configureIntegrations
          ? parseIntegrationIdListInput(form.discordAllowedGuildIds)
          : undefined,
        discordAllowedChannelIds: form.configureIntegrations
          ? parseIntegrationIdListInput(form.discordAllowedChannelIds)
          : undefined,
        discordReplyInThread: form.configureIntegrations ? form.discordReplyInThread : undefined,
        dailyMessageLimit: parseLimitString(form.dailyMessageLimit),
        dailyTokenLimit: parseLimitString(form.dailyTokenLimit),
        monthlySpendLimitUsd: parseLimitString(form.monthlySpendLimitUsd),
        runtimeOptions: runtimeConfig.runtimeOptions,
        runtimeSecrets: runtimeConfig.runtimeSecrets,
      });
      const finalJob = await pollProvisionJob(provision.job.id, setJobStatus);
      if (finalJob.status !== "succeeded") {
        throw new Error(finalJob.error || "Provision job did not complete successfully");
      }

      return {
        agentId: agent.id,
      };
    },
    onSuccess: async (result) => {
      if (isOnboardingMode) {
        markHelperCreated();
      }
      toast.success("Helper setup completed");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["instances"] }),
        queryClient.invalidateQueries({ queryKey: ["agents"] }),
        queryClient.invalidateQueries({ queryKey: ["tenants"] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
        queryClient.invalidateQueries({ queryKey: ["provision-jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["provision-requests"] }),
      ]);
          navigate(`/agents/${encodeURIComponent(result.agentId)}`);
    },
    onError: (error) => {
      const message = getErrorMessage(error, "Setup failed");
      setJobError(message);
      setJobStatus("");
      toast.error(message);
    },
  });

  const progress = ((step + 1) / activeSteps.length) * 100;
  const canProceed =
    validateStep(
      currentStepId,
      form,
      selectedRuntime,
      hasServerDefaultLlmApiKey,
      useDedicatedLlmApiKey,
      workspaces
    );
  const modelCatalogItems =
    modelCatalogQuery.data?.items?.length
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
  const telegramAllowList = parseTelegramAllowListInput(form.telegramAllowFrom);
  const supportsTelegram = selectedRuntime ? supportsTelegramChannelControls(selectedRuntime) : false;
  const closeSetupModal = () => navigate("/dashboard");

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !launchMutation.isPending) {
          closeSetupModal();
        }
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden border border-border/80 bg-card p-0">
        {/* <DialogHeader className="border-b border-border/70 px-6 py-5">
          <DialogTitle>Setup your helper</DialogTitle>
          <DialogDescription>
            Set up your helper's name, identity and make them your ideal co-worker.
          </DialogDescription>
        </DialogHeader> */}

        <div className="max-h-[calc(92vh-5.5rem)] overflow-y-auto px-6 py-5 pb-8">
          <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Step {step + 1} of {activeSteps.length}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="mb-8 h-2" />

          <div className="mx-auto max-w-5xl">
            <Card className="border-border/70 bg-card/85 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-2xl">{currentStep.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{currentStep.subtitle}</p>
              </CardHeader>
              <CardContent className="space-y-6">
            {isOnboardingMode ? (
              <OnboardingGuideStrip
                currentStepId={currentStepId}
                onOpenGuide={() => setIsGuideOpen(true)}
              />
            ) : null}
            {currentStepId === "details" ? (
              <FormSection
                  title=""
                  description=""
              >
              <div className="space-y-4">
                <LabeledField label="Helper name">
                  <Input
                    value={form.agentName}
                    onChange={(event) => setForm((current) => ({ ...current, agentName: event.target.value }))}
                    placeholder="Alex, Maya, Jordan..."
                  />
                </LabeledField>

                <AgentAvatarField
                  avatar={form.avatar}
                  helperName={form.agentName}
                  onRandomize={() =>
                    setForm((current) => ({ ...current, avatar: createRandomAgentAvatar() }))
                  }
                  onRemove={() =>
                    setForm((current) => ({ ...current, avatar: undefined }))
                  }
                />

                <LabeledField label="Identity">
                  <Select
                    value={form.presetId || CUSTOM_PRESET_VALUE}
                    onValueChange={(value) =>
                      setForm((current) =>
                        applyPresetSelection(
                          current,
                          presets,
                          value === CUSTOM_PRESET_VALUE ? undefined : presets.find((preset) => preset.id === value)
                        )
                      )
                    }
                  >
                    <SelectTrigger aria-label="Identity" className="h-12 rounded-2xl border-border/70 bg-background/70">
                      <SelectValue placeholder="Select an identity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CUSTOM_PRESET_VALUE}>Custom / no identity</SelectItem>
                      {presets.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Choose the helper's role here. Keep it custom if you do not want a predefined identity.
                  </p>
                  {presetsQuery.isLoading ? (
                    <div className="rounded-3xl border border-border/70 bg-background/60 px-4 py-5 text-sm text-muted-foreground">
                      Loading identities...
                    </div>
                  ) : null}
                  {presetsQuery.isError ? (
                    <div className="rounded-3xl border border-destructive/20 bg-destructive/5 px-4 py-5 text-sm text-destructive">
                      Identity catalog could not be loaded. You can still create a custom helper.
                    </div>
                  ) : null}
                </LabeledField>

                {currentPreset ? (
                  <div className="rounded-3xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-primary/80">Identity preview</p>
                    <p className="mt-2 font-medium text-foreground">{currentPreset.name}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {formatPresetCategory(currentPreset.category)}
                    </p>
                    <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                      <div className="rounded-2xl border border-primary/15 bg-background/70 p-3">
                        <p className="text-sm text-muted-foreground">{currentPreset.summary}</p>
                        <p className="mt-3 text-xs text-muted-foreground">{currentPreset.description}</p>
                      </div>
                      <div className="rounded-2xl border border-primary/15 bg-background/70 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          What this changes
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Atoll uses this identity to seed the helper&apos;s initial <code>IDENTITY.md</code>, <code>SOUL.md</code>, and <code>TOOLS.md</code>.
                        </p>
                      </div>
                    </div>
                    {identitySkills.length > 0 ? (
                      <div className="mt-4 rounded-2xl border border-primary/15 bg-background/70 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Identity skills
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {identitySkills.map((skill) => (
                            <span
                              key={skill}
                              className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary"
                            >
                              {formatSkillChipLabel(skill)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <LabeledField label="Personality and guidance (Optional)">
                  <Textarea
                    value={form.roleTitle}
                    onChange={(event) => setForm((current) => ({ ...current, roleTitle: event.target.value }))}
                    rows={4}
                    placeholder={
                      currentPreset?.suggestedRoleTitle ||
                      "Optional guidance that shapes how the helper introduces itself and works."
                    }
                  />
                </LabeledField>

                <LabeledField label="Workspace">
                  <Select
                    value={form.workspaceChoice}
                    onValueChange={(value) =>
                      setForm((current) =>
                        applyWorkspaceChoice(current, value as ProvisionWizardState["workspaceChoice"], {
                          defaultWorkspace,
                          dedicatedWorkspaces,
                        })
                      )
                    }
                  >
                    <SelectTrigger className="h-12 rounded-2xl border-border/70 bg-background/70">
                      <SelectValue placeholder="Select workspace" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Use default workspace</SelectItem>
                      <SelectItem value="join">Join existing workspace</SelectItem>
                      <SelectItem value="create">Create dedicated workspace</SelectItem>
                    </SelectContent>
                  </Select>

                  {tenantsQuery.isLoading ? (
                    <div className="mt-3 rounded-3xl border border-border/70 bg-background/60 px-4 py-5 text-sm text-muted-foreground">
                      Loading workspace options...
                    </div>
                  ) : null}

                  {tenantsQuery.isError ? (
                    <div className="mt-3 rounded-3xl border border-destructive/20 bg-destructive/5 px-4 py-5 text-sm text-destructive">
                      Workspace options could not be loaded. Retry once the API is available.
                    </div>
                  ) : null}

                  {form.workspaceChoice === "join" ? (
                    dedicatedWorkspaces.length > 0 ? (
                      <div className="mt-3 space-y-3">
                        <LabeledField label="Dedicated workspace">
                          <Select
                            value={form.selectedTenantId}
                            onValueChange={(value) =>
                              setForm((current) => ({
                                ...current,
                                selectedTenantId: value,
                              }))
                            }
                          >
                            <SelectTrigger className="h-12 rounded-2xl border-border/70 bg-background/70">
                              <SelectValue placeholder="Select a dedicated workspace" />
                            </SelectTrigger>
                            <SelectContent>
                              {dedicatedWorkspaces.map((tenant) => (
                                <SelectItem key={tenant.id} value={tenant.id}>
                                  {tenant.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </LabeledField>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                        No dedicated workspaces are available yet. Create one first, or use the default workspace.
                      </div>
                    )
                  ) : null}

                  {form.workspaceChoice === "create" ? (
                    <div className="mt-3 space-y-3">
                      <LabeledField label="New dedicated workspace name">
                        <Input
                          value={form.tenantName}
                          onChange={(event) => setForm((current) => ({ ...current, tenantName: event.target.value }))}
                          placeholder="Design Crew"
                        />
                      </LabeledField>
                    </div>
                  ) : null}
                </LabeledField>
              </div>
              </FormSection>
            ) : null}

            {currentStepId === "runtime" ? (
              <FormSection
                  title=""
                  description=""
              >
              <div className="space-y-5">
                {runtimeCatalogQuery.isLoading ? (
                  <div className="rounded-3xl border border-border/70 bg-background/60 px-4 py-5 text-sm text-muted-foreground">
                    Loading engine options...
                  </div>
                ) : null}

                {runtimeCatalogQuery.isError ? (
                  <div className="rounded-3xl border border-destructive/20 bg-destructive/5 px-4 py-5 text-sm text-destructive">
                    Engine options could not be loaded. Retry when the API is available.
                  </div>
                ) : null}

        {runtimeCatalog.length > 0 ? (
                  <>
                    {isOnboardingMode && !showAdvancedSetup ? (
                      <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
                        <p className="text-xs uppercase tracking-[0.18em] text-primary/80">
                          {ONBOARDING_COPY.runtimeSummary.title}
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {ONBOARDING_COPY.runtimeSummary.description}
                        </p>
                        <div className="mt-4 grid gap-3 rounded-2xl border border-border/70 bg-background/70 p-4 text-sm sm:grid-cols-3">
                          <SummaryRow
                            label="Engine"
                            value={selectedRuntime?.label || "Recommended default"}
                          />
                          <SummaryRow
                            label="AI defaults"
                            value={
                              form.llmModel ||
                              healthQuery.data?.runtime.defaultModel ||
                              "Recommended default"
                            }
                          />
                          <SummaryRow
                            label="Channels"
                            value="Add later from helper settings"
                          />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowAdvancedSetup(true)}
                          >
                            Show advanced setup
                          </Button>
                          <p className="text-sm text-muted-foreground">
                            You can keep going with the recommended setup and edit details later.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <LabeledField label="Engine">
                          <Select
                            value={selectedRuntime?.id || form.runtimeType}
                            onValueChange={(value) => {
                              const nextRuntime = runtimeCatalog.find((item) => item.id === value);
                              if (!nextRuntime) {
                                return;
                              }
                              setForm((current) => applyRuntimeSelection(current, nextRuntime));
                            }}
                          >
                            <SelectTrigger className="h-12 rounded-2xl border-border/70 bg-background/70">
                              <SelectValue placeholder="Select an engine" />
                            </SelectTrigger>
                            <SelectContent>
                              {runtimeCatalog.map((runtime) => (
                                <SelectItem key={runtime.id} value={runtime.id}>
                                  {runtime.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {/* <p className="mt-2 text-sm text-muted-foreground">
                            Atoll only shows engines available on this host.
                          </p> */}
                        </LabeledField>
                        {isOnboardingMode ? (
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowAdvancedSetup(false)}
                            >
                              Back to recommended setup
                            </Button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </>
                ) : null}

                {selectedRuntime ? (
                  <>
                    {isOnboardingMode && !showAdvancedSetup ? null : (
                    <LabeledField label="API key (Optional)">
                      <label className="mb-3 flex items-center gap-2 rounded-xl border border-border/70 bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
                        <Checkbox
                          aria-label="Use dedicated API key"
                          checked={useDedicatedLlmApiKey}
                          disabled={!hasServerDefaultLlmApiKey}
                          onCheckedChange={(value) => setUseDedicatedLlmApiKey(Boolean(value))}
                        />
                        Use dedicated API key
                      </label>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {hasServerDefaultLlmApiKey
                          ? "Keep this off to use the default AI key."
                          : "This host does not provide a default AI key, so a dedicated key is required."}
                      </p>
                      {useDedicatedLlmApiKey ? (
                        <Input
                          className="mt-3"
                          type="password"
                          value={form.llmApiKey}
                          onChange={(event) => setForm((current) => ({ ...current, llmApiKey: event.target.value }))}
                          placeholder="Paste your OpenRouter key"
                        />
                      ) : null}
                    </LabeledField>
                    )}

                    {isOnboardingMode && !showAdvancedSetup ? null : (
                    <LabeledField label="AI model">
                      <ModelPickerField
                        value={form.llmModel}
                        fallbackLabel={healthQuery.data?.runtime.defaultModel || "Choose a model"}
                        items={modelCatalogItems}
                        onChange={(value) =>
                          setForm((current) => ({ ...current, llmModel: value }))
                        }
                        statusText={modelCatalogStatusText}
                      />
                    </LabeledField>
                    )}

                    {isOnboardingMode && !showAdvancedSetup ? null : (
                    <label className="flex items-start gap-3 rounded-3xl border border-border/70 bg-background/60 px-4 py-4 text-sm">
                      <Checkbox
                        aria-label="Connect to messaging platforms?"
                        checked={form.configureIntegrations}
                        onCheckedChange={(value) =>
                          setForm((current) => ({ ...current, configureIntegrations: Boolean(value) }))
                        }
                      />
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">Connect to messaging platforms?</p>
                        <p className="text-muted-foreground">
                          Keep setup shorter by skipping Discord, or Telegram for now. You can add them later from helper settings.
                        </p>
                      </div>
                    </label>
                    )}

                    {isOnboardingMode && !showAdvancedSetup ? null : selectedRuntime.runtimeConfigFields.length > 0 ? (
                      <div className="rounded-3xl border border-border/70 bg-background/60 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Engine settings
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          These extra settings come from the selected engine.
                        </p>
                        <div className="mt-4">
                          <RuntimeConfigFields
                            fields={selectedRuntime.runtimeConfigFields}
                            values={form.runtimeConfig}
                            onChange={(key, value) =>
                              setForm((current) => ({
                                ...current,
                                runtimeConfig: { ...current.runtimeConfig, [key]: value },
                              }))
                            }
                          />
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
              </FormSection>
            ) : null}

            {currentStepId === "connections" ? (
              <FormSection
                  title=""
                  description=""
              >
              <div className="space-y-5">
                {!selectedRuntime ? (
                  <div className="rounded-3xl border border-border/70 bg-background/60 px-4 py-5 text-sm text-muted-foreground">
                    Pick an engine in the previous step to unlock connection settings.
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {supportsTelegram ? (
                      <TelegramIntegrationCard
                        enabled={form.telegramEnabled}
                        onEnabledChange={(value) =>
                          setForm((current) => ({ ...current, telegramEnabled: value }))
                        }
                        summary="Telegram is off. Turn it on to configure bot access before launch."
                        tokenField={
                          selectedRuntime.capabilities.telegramToken
                            ? {
                                value: form.telegramBotToken,
                                onChange: (value) =>
                                  setForm((current) => ({
                                    ...current,
                                    telegramBotToken: value,
                                  })),
                                placeholder: "123456789:ABC...",
                              }
                            : undefined
                        }
                        allowListValue={
                          selectedRuntime.capabilities.telegramAllowFrom ? form.telegramAllowFrom : undefined
                        }
                        onAllowListChange={
                          selectedRuntime.capabilities.telegramAllowFrom
                            ? (value) =>
                                setForm((current) => ({
                                  ...current,
                                  telegramAllowFrom: value,
                                }))
                            : undefined
                        }
                        allowListWarnings={telegramAllowList.warnings}
                      />
                    ) : null}

                    <SlackIntegrationCard
                      enabled={form.slackEnabled}
                      onEnabledChange={(value) =>
                        setForm((current) => ({ ...current, slackEnabled: value }))
                      }
                      summary="Slack is off. Turn it on to add the bot credentials and allowlists before launch."
                      alwaysVisibleContent={
                        <SetupSlackGuidePanel
                          slackBotToken={form.slackBotToken}
                          slackAppToken={form.slackAppToken}
                        />
                      }
                      botToken={form.slackBotToken}
                      onBotTokenChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          slackBotToken: value,
                        }))
                      }
                      botTokenPlaceholder="xoxb-..."
                      appToken={form.slackAppToken}
                      onAppTokenChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          slackAppToken: value,
                        }))
                      }
                      appTokenPlaceholder="xapp-..."
                      allowedChannelIds={form.slackAllowedChannelIds}
                      onAllowedChannelIdsChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          slackAllowedChannelIds: value,
                        }))
                      }
                      allowedUserIds={form.slackAllowedUserIds}
                      onAllowedUserIdsChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          slackAllowedUserIds: value,
                        }))
                      }
                      replyInThread={form.slackReplyInThread}
                      onReplyInThreadChange={(checked) =>
                        setForm((current) => ({
                          ...current,
                          slackReplyInThread: checked,
                        }))
                      }
                    />

                    <DiscordIntegrationCard
                      enabled={form.discordEnabled}
                      onEnabledChange={(value) =>
                        setForm((current) => ({ ...current, discordEnabled: value }))
                      }
                      summary="Discord is off. Turn it on to configure the bot token and allowlists before launch."
                      botToken={form.discordBotToken}
                      onBotTokenChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          discordBotToken: value,
                        }))
                      }
                      botTokenPlaceholder="Discord bot token"
                      allowedGuildIds={form.discordAllowedGuildIds}
                      onAllowedGuildIdsChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          discordAllowedGuildIds: value,
                        }))
                      }
                      allowedChannelIds={form.discordAllowedChannelIds}
                      onAllowedChannelIdsChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          discordAllowedChannelIds: value,
                        }))
                      }
                      replyInThread={form.discordReplyInThread}
                      onReplyInThreadChange={(checked) =>
                        setForm((current) => ({
                          ...current,
                          discordReplyInThread: checked,
                        }))
                      }
                    />
                  </div>
                )}
              </div>
              </FormSection>
            ) : null}

            {currentStepId === "review" ? (
              <div className="space-y-4">
                <Card className="border-border/70 bg-background/70">
                  <CardContent className="grid gap-4 p-5 text-sm sm:grid-cols-2">
                    <SummaryRow label="Workspace" value={workspaceSummary.name} />
                    <SummaryRow label="Helper name" value={form.agentName} />
                    <SummaryRow label="Identity" value={currentPreset?.name || "Custom"} />
                    <SummaryRow label="Engine" value={selectedRuntime?.label || form.runtimeType} />
                    <SummaryRow label="LLM model" value={form.llmModel} />
                    <SummaryRow label="Connections" value={buildConnectionSummary(selectedRuntime, form)} />
                  </CardContent>
                </Card>

                {jobStatus ? (
                  <div className="rounded-3xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary">
                    {jobStatus}
                  </div>
                ) : null}

                {jobError ? (
                  <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                    {jobError}
                  </div>
                ) : null}
              </div>
            ) : null}

              </CardContent>
            </Card>
          </div>

          <div className="mt-8 flex items-center justify-between pb-4">
          <Button
            variant="ghost"
            onClick={() => {
              if (step === 0) {
                closeSetupModal();
                return;
              }
              setStep((current) => current - 1);
            }}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {step === 0 ? "Back to helpers" : "Back"}
          </Button>

            {step < activeSteps.length - 1 ? (
              <Button onClick={() => setStep((current) => current + 1)} disabled={!canProceed} className="gap-2">
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => void launchMutation.mutateAsync()} disabled={launchMutation.isPending || !canProceed} className="gap-2">
                {launchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                Create helper
              </Button>
            )}
          </div>
        </div>
        <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
          <DialogContent className="max-w-4xl border border-border/80 bg-card p-0">
            <DialogHeader className="border-b border-border/70 px-6 py-5">
              <DialogTitle>Launch in three moves</DialogTitle>
              <DialogDescription>
                Follow this path for the fastest first success: create one helper with safe defaults, confirm it replies once, then come back for deeper tuning.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 px-6 py-5">
              <div className="grid gap-4 md:grid-cols-3">
                {buildGuideCards(currentStepId).map((card) => (
                  <GuideShotCard
                    key={card.title}
                    eyebrow={card.eyebrow}
                    title={card.title}
                    body={card.body}
                    previewLabel={card.previewLabel}
                    preview={card.preview}
                    isActive={card.isActive}
                  />
                ))}
              </div>
              <div className="flex items-start justify-between gap-4 rounded-3xl border border-primary/15 bg-primary/5 px-4 py-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-primary/80">Good default</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {currentStepId === "connections"
                      ? "Only wire up the channels you need right now. Once the helper is live, you can come back for tighter allowlists, richer routing, and the rest of the channel polish."
                      : "First success matters more than full configuration. Once the helper is replying in chat, you can safely add channels, tune runtime options, and refine behavior without repeating setup."}
                  </p>
                </div>
                <Button type="button" onClick={() => setIsGuideOpen(false)}>
                  Back to setup
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

function applyPresetSelection(
  current: ProvisionWizardState,
  presets: AgentPreset[],
  nextPreset?: AgentPreset
): ProvisionWizardState {
  const previousPreset = presets.find((preset) => preset.id === current.presetId);
  const previousSuggested = previousPreset?.suggestedRoleTitle ?? "";
  const nextSuggested = nextPreset?.suggestedRoleTitle ?? "";
  const shouldReplaceRoleTitle =
    current.roleTitle.trim().length === 0 ||
    (previousSuggested.length > 0 && current.roleTitle.trim() === previousSuggested);

  return {
    ...current,
    presetId: nextPreset?.id ?? "",
    roleTitle: shouldReplaceRoleTitle ? nextSuggested : current.roleTitle,
  };
}

function formatPresetCategory(value: AgentPreset["category"]): string {
  if (value === "project-management") {
    return "Project Management";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function pollProvisionJob(
  jobId: string,
  setJobStatus: (value: string) => void,
  onUpdate?: (job: ProvisionJobSnapshot) => void
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 180_000) {
    const job = await getProvisionJob(jobId);
    onUpdate?.(job);
    setJobStatus(`Provision job ${job.status} · updated ${new Date(job.updatedAt).toLocaleTimeString()}`);
    if (job.status === "succeeded" || job.status === "failed") {
      return job;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 2_000));
  }

  throw new Error("Provision job timed out after 3 minutes");
}

function validateStep(
  stepId: WizardStepId,
  form: ProvisionWizardState,
  runtime?: RuntimeCatalogItem,
  hasServerDefaultLlmApiKey = false,
  useDedicatedLlmApiKey = false,
  workspaces: Tenant[] = []
): boolean {
  if (stepId === "details") {
    if (form.agentName.trim().length < 2) {
      return false;
    }

    if (form.workspaceChoice === "default") {
      return workspaces.some((tenant) => tenant.isDefault) || form.tenantName.trim().length >= 2;
    }

    if (form.workspaceChoice === "join") {
      return workspaces.some(
        (tenant) => tenant.id === form.selectedTenantId && tenant.kind === "dedicated" && !tenant.isDefault
      );
    }

    return form.tenantName.trim().length >= 2;
  }

  if (stepId === "runtime") {
    if (!runtime) {
      return false;
    }

    try {
      parseLimitString(form.dailyMessageLimit);
      parseLimitString(form.dailyTokenLimit);
      parseLimitString(form.monthlySpendLimitUsd);
      parseRuntimeConfigFormState({
        fields: runtime.runtimeConfigFields,
        values: form.runtimeConfig,
        requireSecretValues: true,
      });
    } catch {
      return false;
    }

    return Boolean(
      form.llmModel.trim() &&
      (useDedicatedLlmApiKey ? form.llmApiKey.trim() : hasServerDefaultLlmApiKey)
    );
  }

  if (stepId === "connections") {
    if (!runtime) {
      return false;
    }

    if (supportsTelegramChannelControls(runtime) && form.telegramEnabled && runtime.capabilities.telegramToken && !form.telegramBotToken.trim()) {
      return false;
    }
    if (form.slackEnabled && (!form.slackBotToken.trim() || !form.slackAppToken.trim())) {
      return false;
    }
    if (form.discordEnabled && !form.discordBotToken.trim()) {
      return false;
    }
    return true;
  }

  return true;
}

function applyRuntimeSelection(
  current: ProvisionWizardState,
  runtime: RuntimeCatalogItem
): ProvisionWizardState {
  return {
    ...current,
    runtimeType: runtime.id,
    telegramEnabled: supportsTelegramChannelControls(runtime) ? current.telegramEnabled : false,
    telegramBotToken: runtime.capabilities.telegramToken ? current.telegramBotToken : "",
    telegramAllowFrom: runtime.capabilities.telegramAllowFrom ? current.telegramAllowFrom : "",
    telegramReplyInPrivate: runtime.capabilities.telegramReplyInPrivate
      ? current.telegramReplyInPrivate
      : false,
    runtimeConfig: mergeRuntimeConfigState(current.runtimeConfig, runtime.runtimeConfigFields),
  };
}

function supportsTelegramChannelControls(runtime: RuntimeCatalogItem): boolean {
  return Boolean(
    runtime.capabilities.telegramToken ||
      runtime.capabilities.telegramAllowFrom ||
      runtime.capabilities.telegramReplyInPrivate
  );
}

function mergeRuntimeConfigState(
  current: RuntimeConfigFormState,
  fields: RuntimeCatalogItem["runtimeConfigFields"]
): RuntimeConfigFormState {
  if (fields.length === 0) {
    return current;
  }

  const defaults = buildRuntimeConfigFormState({ fields });
  const nextState = { ...current };

  for (const field of fields) {
    nextState[field.key] = current[field.key] ?? defaults[field.key];
  }

  return nextState;
}

function applyWorkspaceChoice(
  current: ProvisionWizardState,
  nextChoice: ProvisionWizardState["workspaceChoice"],
  options: {
    defaultWorkspace?: Tenant;
    dedicatedWorkspaces: Tenant[];
  }
): ProvisionWizardState {
  if (nextChoice === "default") {
    return {
      ...current,
      workspaceChoice: nextChoice,
      selectedTenantId: options.defaultWorkspace?.id ?? "",
      tenantName: options.defaultWorkspace?.name ?? DEFAULT_WORKSPACE_NAME,
    };
  }

  if (nextChoice === "join") {
    const selectedTenantId =
      options.dedicatedWorkspaces.find((tenant) => tenant.id === current.selectedTenantId)?.id ??
      options.dedicatedWorkspaces[0]?.id ??
      "";

    return {
      ...current,
      workspaceChoice: nextChoice,
      selectedTenantId,
    };
  }

  return {
    ...current,
    workspaceChoice: nextChoice,
    selectedTenantId: "",
    tenantName:
      current.workspaceChoice === "default" && current.tenantName.trim() === DEFAULT_WORKSPACE_NAME
        ? ""
        : current.tenantName,
  };
}

function describeWorkspaceSelection(
  form: ProvisionWizardState,
  defaultWorkspace: Tenant | undefined,
  dedicatedWorkspaces: Tenant[]
): { name: string; mode: string } {
  if (form.workspaceChoice === "default") {
    return {
      name: defaultWorkspace?.name || DEFAULT_WORKSPACE_NAME,
      mode: "Default workspace · Individual helper resources",
    };
  }

  if (form.workspaceChoice === "join") {
    const tenant = dedicatedWorkspaces.find((item) => item.id === form.selectedTenantId);
    return {
      name: tenant?.name || "Dedicated workspace pending",
      mode: "Dedicated workspace · Shared network and collaboration volume",
    };
  }

  return {
    name: form.tenantName.trim() || "New dedicated workspace",
    mode: "Dedicated workspace · Shared network and collaboration volume",
  };
}

function buildConnectionSummary(runtime: RuntimeCatalogItem | undefined, form: ProvisionWizardState): string {
  if (!form.configureIntegrations) {
    return "Skipped during setup";
  }

  const parts: string[] = [];
  if (runtime && supportsTelegramChannelControls(runtime)) {
    parts.push(`Telegram ${form.telegramEnabled ? "on" : "off"}`);
  }
  parts.push(`Slack ${form.slackEnabled ? "on" : "off"}`);
  parts.push(`Discord ${form.discordEnabled ? "on" : "off"}`);
  return parts.join(" · ");
}

function OnboardingGuideStrip({
  currentStepId,
  onOpenGuide,
}: {
  currentStepId: WizardStepId;
  onOpenGuide: () => void;
}) {
  const isConnectionsGuide = currentStepId === "connections";
  const steps: Array<{ id: WizardStepId; label: string }> = [
    {
      id: "details",
      label: "Identity",
    },
    {
      id: "runtime",
      label: "Runtime",
    },
    {
      id: "review",
      label: "Launch",
    },
  ];

  return (
    <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em] text-primary/80">
              {isConnectionsGuide ? "Connections setup guide" : "Quick onboarding guide"}
            </p>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {isConnectionsGuide
              ? "Only turn on the channels you need for the first launch, save the required tokens, and leave the rest for helper settings."
              : "Keep this flow short: pick an identity, keep the recommended runtime, then test one first reply in chat."}
          </p>
        </div>
        <Button type="button" variant="outline" className="gap-2" onClick={onOpenGuide}>
          <Images className="h-4 w-4" />
          Open quick guide
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {steps.map((step) => {
          const isActive =
            step.id === currentStepId ||
            (currentStepId === "connections" && step.id === "review");

          return (
            <div
              key={step.id}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                isActive
                  ? "border-primary/30 bg-background/90 text-foreground"
                  : "border-border/70 bg-background/70 text-muted-foreground"
              }`}
            >
              {step.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildGuideCards(currentStepId: WizardStepId): Array<{
  eyebrow: string;
  title: string;
  body: string;
  previewLabel: string;
  preview: ReactNode;
  isActive: boolean;
}> {
  if (currentStepId === "connections") {
    return [
      {
        eyebrow: "Step 1",
        title: "Turn on only what you need",
        body: "Only turn on the channels you need for the first launch. Leave the rest off so setup stays easier to validate.",
        previewLabel: "Connections preview",
        preview: <GuideConnectionsPreview />,
        isActive: true,
      },
      {
        eyebrow: "Step 2",
        title: "Paste the required tokens",
        body: "Save just the credentials needed to get one working route online. You can add stricter channel or user rules after the helper is already responding.",
        previewLabel: "Token preview",
        preview: <GuideTokenPreview />,
        isActive: true,
      },
      {
        eyebrow: "Step 3",
        title: "Launch and test from the source app",
        body: "After launch, send a message from Slack, Discord, or Telegram and confirm the helper replies in the expected place before adding more channels.",
        previewLabel: "Launch preview",
        preview: <GuideLaunchPreview />,
        isActive: true,
      },
    ];
  }

  return [
    {
      eyebrow: "Step 1",
      title: "Pick a helper identity",
      body: "Choose the role that is closest to the helper you want. Keep the default workspace unless you already know this helper needs its own isolated setup.",
      previewLabel: "Helper card preview",
      preview: <GuideIdentityPreview />,
      isActive: currentStepId === "details",
    },
    {
      eyebrow: "Step 2",
      title: "Keep the recommended runtime",
      body: "Use the suggested engine and model for the first launch. Skip channel setup here unless you need it immediately, because helper settings stays easier to adjust later.",
      previewLabel: "Runtime preview",
      preview: <GuideRuntimePreview />,
      isActive: currentStepId === "runtime",
    },
    {
      eyebrow: "Step 3",
      title: "Launch, then send one message",
      body: "Create the helper, open its chat, and send one simple prompt. If you get a clean reply, the core setup worked and you can iterate from there.",
      previewLabel: "Chat preview",
      preview: <GuideChatPreview />,
      isActive: currentStepId === "review",
    },
  ];
}

function GuideShotCard({
  eyebrow,
  title,
  body,
  previewLabel,
  preview,
  isActive,
}: {
  eyebrow: string;
  title: string;
  body: string;
  previewLabel: string;
  preview: ReactNode;
  isActive: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-4 ${
        isActive ? "border-primary/25 bg-primary/5" : "border-border/70 bg-background/70"
      }`}
    >
      <p className="text-[11px] uppercase tracking-[0.18em] text-primary/80">{eyebrow}</p>
      <p className="mt-2 text-base font-semibold text-foreground">{title}</p>
      <p className="mt-2 min-h-24 text-sm leading-6 text-muted-foreground">{body}</p>
      <div className="mt-4">
        <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {previewLabel}
        </p>
        <div className="relative isolate min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-background">
          {preview}
        </div>
      </div>
    </div>
  );
}

function GuideIdentityPreview() {
  return (
    <div className="h-[160px] space-y-3 overflow-hidden bg-[linear-gradient(180deg,rgba(7,162,202,0.08),transparent)] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
          AX
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="h-3 w-24 max-w-full rounded-full bg-foreground/90" />
          <div className="h-2.5 w-32 max-w-full rounded-full bg-muted-foreground/30" />
        </div>
      </div>
      <div className="rounded-2xl border border-border/70 bg-card px-3 py-3">
        <div className="h-2.5 w-20 max-w-full rounded-full bg-primary/20" />
        <div className="mt-3 h-2.5 w-full max-w-full rounded-full bg-muted-foreground/20" />
        <div className="mt-2 h-2.5 w-4/5 max-w-full rounded-full bg-muted-foreground/20" />
        <div className="mt-2 h-2.5 w-3/5 max-w-full rounded-full bg-muted-foreground/20" />
      </div>
    </div>
  );
}

function GuideRuntimePreview() {
  return (
    <div className="h-[160px] space-y-3 overflow-hidden bg-[linear-gradient(180deg,rgba(7,162,202,0.06),transparent)] p-4">
      <div className="rounded-2xl border border-border/70 bg-card px-3 py-3">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="h-3 w-24 max-w-full rounded-full bg-foreground/90" />
            <div className="mt-2 h-2.5 w-36 max-w-full rounded-full bg-muted-foreground/20" />
          </div>
          <div className="max-w-[96px] truncate rounded-full border border-primary/20 px-2 py-1 text-[10px] text-primary">
            Best match
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-dashed border-border/70 bg-background px-3 py-4">
        <div className="h-2.5 w-28 max-w-full rounded-full bg-muted-foreground/20" />
        <div className="mt-3 flex gap-2">
          <div className="h-7 w-16 max-w-full rounded-full bg-primary/12" />
          <div className="h-7 w-16 max-w-full rounded-full bg-muted/80" />
        </div>
      </div>
    </div>
  );
}

function GuideChatPreview() {
  return (
    <div className="h-[160px] space-y-3 overflow-hidden bg-[linear-gradient(180deg,rgba(7,162,202,0.06),transparent)] p-4">
      <div className="flex justify-end">
        <div className="max-w-[80%] overflow-hidden rounded-2xl rounded-tr-md border border-border/70 bg-card px-3 py-2">
          <div className="h-2.5 w-40 max-w-full rounded-full bg-muted-foreground/20" />
        </div>
      </div>
      <div className="flex justify-start">
        <div className="max-w-[75%] overflow-hidden rounded-2xl rounded-tl-md bg-primary px-3 py-2">
          <div className="h-2.5 w-32 max-w-full rounded-full bg-primary-foreground/80" />
        </div>
      </div>
      <div className="rounded-2xl border border-border/70 bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-muted-foreground" />
          <div className="h-2.5 w-28 max-w-full rounded-full bg-muted-foreground/20" />
        </div>
      </div>
    </div>
  );
}

function GuideConnectionsPreview() {
  return (
    <div className="h-[160px] space-y-3 overflow-hidden bg-[linear-gradient(180deg,rgba(7,162,202,0.06),transparent)] p-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-primary/20 bg-primary/10 px-3 py-3">
          <div className="h-2.5 w-12 rounded-full bg-primary/40" />
          <div className="mt-3 h-6 w-full rounded-full bg-primary/15" />
        </div>
        <div className="rounded-2xl border border-border/70 bg-card px-3 py-3">
          <div className="h-2.5 w-14 rounded-full bg-muted-foreground/20" />
          <div className="mt-3 h-6 w-full rounded-full bg-muted/70" />
        </div>
      </div>
      <div className="rounded-2xl border border-dashed border-border/70 bg-background px-3 py-4">
        <div className="h-2.5 w-24 rounded-full bg-muted-foreground/20" />
        <div className="mt-3 flex gap-2">
          <div className="h-7 w-16 rounded-full bg-primary/12" />
          <div className="h-7 w-16 rounded-full bg-muted/80" />
        </div>
      </div>
    </div>
  );
}

function GuideTokenPreview() {
  return (
    <div className="h-[160px] space-y-3 overflow-hidden bg-[linear-gradient(180deg,rgba(7,162,202,0.06),transparent)] p-4">
      <div className="rounded-2xl border border-border/70 bg-card px-3 py-3">
        <div className="h-2.5 w-20 rounded-full bg-muted-foreground/20" />
        <div className="mt-3 h-9 w-full rounded-2xl bg-background" />
      </div>
      <div className="rounded-2xl border border-border/70 bg-card px-3 py-3">
        <div className="h-2.5 w-16 rounded-full bg-muted-foreground/20" />
        <div className="mt-3 h-9 w-full rounded-2xl bg-background" />
      </div>
    </div>
  );
}

function GuideLaunchPreview() {
  return (
    <div className="h-[160px] space-y-3 overflow-hidden bg-[linear-gradient(180deg,rgba(7,162,202,0.06),transparent)] p-4">
      <div className="flex justify-between gap-3 rounded-2xl border border-border/70 bg-card px-3 py-3">
        <div className="space-y-2">
          <div className="h-2.5 w-20 rounded-full bg-foreground/90" />
          <div className="h-2.5 w-28 rounded-full bg-muted-foreground/20" />
        </div>
        <div className="h-6 w-14 rounded-full border border-primary/20 bg-primary/10" />
      </div>
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-2xl bg-primary px-3 py-2">
          <div className="h-2.5 w-24 rounded-full bg-primary-foreground/80" />
        </div>
      </div>
    </div>
  );
}

function parseLimitString(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Usage budget values must be positive numbers");
  }
  return parsed;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <KeyValueItem label={label} value={value} />;
}

function formatSkillChipLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  try {
    const url = new URL(trimmed);
    const normalizedPath = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
    return normalizedPath || url.hostname;
  } catch {
    return trimmed.replace(/^(https?:\/\/)?(www\.)?/iu, "").replace(/\/+$/u, "");
  }
}

