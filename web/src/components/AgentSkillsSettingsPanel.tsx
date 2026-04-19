import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Link2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type {
  Agent,
  AgentInstalledSkill,
  AgentSkillCatalogItem,
  UpdateAgentResponse
} from "@/lib/api";
import { deriveSkillKey, formatSkillLabel, isSupportedSkillRef } from "@/lib/skills";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type AgentSkillsSettingsPanelProps = {
  agent: Agent;
  catalogItems: AgentSkillCatalogItem[];
  savePending?: boolean;
  onSave: (input: {
    skills: string[];
    installedSkills: AgentInstalledSkill[];
  }) => Promise<UpdateAgentResponse>;
};

type SaveNotice = {
  tone: "synced" | "deferred";
  message: string;
};

export function AgentSkillsSettingsPanel({
  agent,
  catalogItems,
  savePending = false,
  onSave
}: AgentSkillsSettingsPanelProps) {
  const [installedSkills, setInstalledSkills] = useState<AgentInstalledSkill[]>(agent.installedSkills);
  const [enabledSkills, setEnabledSkills] = useState<string[]>(agent.skills);
  const [installRef, setInstallRef] = useState("");
  const [installKey, setInstallKey] = useState("");
  const [saveNotice, setSaveNotice] = useState<SaveNotice | undefined>(undefined);

  useEffect(() => {
    setInstalledSkills(agent.installedSkills);
    setEnabledSkills(agent.skills);
    setSaveNotice(undefined);
  }, [agent.id, agent.installedSkills, agent.skills]);

  const recommendedItems = useMemo(() => {
    if (!agent.presetId) {
      return catalogItems;
    }

    const filtered = catalogItems.filter((item) =>
      item.sourcePresets.some((preset) => preset.presetId === agent.presetId)
    );
    return filtered.length > 0 ? filtered : catalogItems;
  }, [agent.presetId, catalogItems]);

  const orderedInstalledSkills = useMemo(
    () => sortInstalledSkillsForDisplay(installedSkills, enabledSkills),
    [enabledSkills, installedSkills]
  );
  const dirty =
    !areStringArraysEqual(enabledSkills, agent.skills) ||
    !areInstalledSkillsEqual(installedSkills, agent.installedSkills);

  async function handleSave() {
    const response = await onSave({
      skills: enabledSkills,
      installedSkills
    });

    setSaveNotice({
      tone: response.workspaceSync.status === "synced" ? "synced" : "deferred",
      message: response.workspaceSync.message
    });
  }

  function toggleSkillEnabled(skillKey: string, nextEnabled: boolean) {
    setSaveNotice(undefined);
    setEnabledSkills((current) => {
      const normalizedKey = skillKey.toLowerCase();
      const filtered = current.filter((item) => item.toLowerCase() !== normalizedKey);
      return nextEnabled ? [...filtered, skillKey] : filtered;
    });
  }

  function moveEnabledSkill(skillKey: string, direction: -1 | 1) {
    setSaveNotice(undefined);
    setEnabledSkills((current) => {
      const index = current.findIndex((item) => item.toLowerCase() === skillKey.toLowerCase());
      if (index < 0) {
        return current;
      }
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  function uninstallSkill(skillKey: string) {
    setSaveNotice(undefined);
    setInstalledSkills((current) =>
      current.filter((skill) => skill.key.toLowerCase() !== skillKey.toLowerCase())
    );
    setEnabledSkills((current) =>
      current.filter((skill) => skill.toLowerCase() !== skillKey.toLowerCase())
    );
  }

  function installRecommendedSkill(item: AgentSkillCatalogItem) {
    const existing = installedSkills.find((skill) => skill.key.toLowerCase() === item.key.toLowerCase());
    if (existing) {
      toggleSkillEnabled(existing.key, true);
      return;
    }

    const now = new Date().toISOString();
    setSaveNotice(undefined);
    setInstalledSkills((current) => [
      ...current,
      {
        key: item.key,
        ref: item.ref,
        label: item.label,
        sourceKind: "curated",
        installedAt: now,
        updatedAt: now
      }
    ]);
    setEnabledSkills((current) => [...current, item.key]);
  }

  function installManualSkillFromUrl() {
    const ref = installRef.trim();
    const explicitKey = installKey.trim();
    if (!isSupportedSkillRef(ref, explicitKey)) {
      toast.error(
        "Supported sources are skills.sh pages, agentskills.co.il skill pages, GitHub URLs, local paths, and raw markdown skill files."
      );
      return;
    }

    const key = deriveSkillKey(ref, explicitKey);
    if (!key) {
      toast.error("Could not resolve a skill key. Provide one explicitly for repo-level sources.");
      return;
    }
    if (
      installedSkills.some(
        (skill) =>
          skill.key.toLowerCase() === key.toLowerCase() || skill.ref.toLowerCase() === ref.toLowerCase()
      )
    ) {
      toast.error("That skill is already installed.");
      return;
    }

    const now = new Date().toISOString();
    setSaveNotice(undefined);
    setInstalledSkills((current) => [
      ...current,
      {
        key,
        ref,
        label: formatSkillLabel(ref, key),
        sourceKind: "manual",
        installedAt: now,
        updatedAt: now
      }
    ]);
    setEnabledSkills((current) => [...current, key]);
    setInstallRef("");
    setInstallKey("");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 border-b border-border/70 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">Installed</CardTitle>
            <p className="text-sm text-muted-foreground">
              Manage each installed skill, choose which ones are enabled, and control the effective order.
            </p>
          </div>
          <Button type="button" className="gap-2" disabled={!dirty || savePending} onClick={() => void handleSave()}>
            {savePending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save skills
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          {saveNotice ? (
            <div
              className={
                saveNotice.tone === "synced"
                  ? "rounded-2xl border border-emerald-300/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100"
                  : "rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
              }
            >
              {saveNotice.message}
            </div>
          ) : null}

          {orderedInstalledSkills.length > 0 ? (
            <div className="space-y-3">
              {orderedInstalledSkills.map((skill) => {
                const enabledIndex = enabledSkills.findIndex(
                  (item) => item.toLowerCase() === skill.key.toLowerCase()
                );
                const enabled = enabledIndex >= 0;
                const presetOrigins = catalogItems
                  .find((item) => item.key.toLowerCase() === skill.key.toLowerCase())
                  ?.sourcePresets.map((preset) => preset.presetName)
                  .join(", ");

                return (
                  <div
                    key={skill.key}
                    data-testid={`installed-skill-${skill.key}`}
                    className="rounded-2xl border border-border/70 bg-background/70 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{skill.label}</p>
                          <span className="rounded-full border border-border/70 px-2 py-0.5 text-xs text-muted-foreground">
                            {skill.key}
                          </span>
                          <span className="rounded-full border border-border/70 px-2 py-0.5 text-xs text-muted-foreground">
                            {skill.sourceKind}
                          </span>
                          {enabled ? (
                            <span className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-800 dark:text-emerald-200">
                              Enabled #{enabledIndex + 1}
                            </span>
                          ) : (
                            <span className="rounded-full border border-border/70 px-2 py-0.5 text-xs text-muted-foreground">
                              Disabled
                            </span>
                          )}
                        </div>
                        <p className="break-all text-sm text-muted-foreground">{skill.ref}</p>
                        {presetOrigins ? (
                          <p className="text-xs text-muted-foreground">Recommended by: {presetOrigins}</p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 rounded-full border border-border/70 px-3 py-2">
                          <Switch
                            checked={enabled}
                            onCheckedChange={(checked) => toggleSkillEnabled(skill.key, checked)}
                            aria-label={`Enable ${skill.label}`}
                          />
                          <span className="text-sm">{enabled ? "Enabled" : "Disabled"}</span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          data-testid={`move-skill-up-${skill.key}`}
                          disabled={!enabled || enabledIndex === 0}
                          onClick={() => moveEnabledSkill(skill.key, -1)}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          data-testid={`move-skill-down-${skill.key}`}
                          disabled={!enabled || enabledIndex === enabledSkills.length - 1}
                          onClick={() => moveEnabledSkill(skill.key, 1)}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          data-testid={`uninstall-skill-${skill.key}`}
                          onClick={() => uninstallSkill(skill.key)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Uninstall
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
              No skills are installed for this helper yet.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle className="text-lg">Recommended for this preset</CardTitle>
          <p className="text-sm text-muted-foreground">
            Curated install candidates come from active preset recommendations. Installing from here preserves the ref that the runtime will materialize inside the helper workspace.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 p-6">
          {recommendedItems.length > 0 ? (
            recommendedItems.map((item) => {
              const installed = installedSkills.some(
                (skill) => skill.key.toLowerCase() === item.key.toLowerCase()
              );
              const enabled = enabledSkills.some((skill) => skill.toLowerCase() === item.key.toLowerCase());
              const originLabel = item.sourcePresets.map((preset) => preset.presetName).join(", ");

              return (
                <div
                  key={item.key}
                  data-testid={`recommended-skill-${item.key}`}
                  className="rounded-2xl border border-border/70 bg-background/70 p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.label}</p>
                        <span className="rounded-full border border-border/70 px-2 py-0.5 text-xs text-muted-foreground">
                          {item.key}
                        </span>
                        {installed ? (
                          <span className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-800 dark:text-emerald-200">
                            {enabled ? "Installed + enabled" : "Installed"}
                          </span>
                        ) : null}
                      </div>
                      <p className="break-all text-sm text-muted-foreground">{item.ref}</p>
                      {originLabel ? (
                        <p className="text-xs text-muted-foreground">Origins: {originLabel}</p>
                      ) : null}
                    </div>

                    <Button
                      type="button"
                      variant={installed ? "outline" : "default"}
                      data-testid={`install-recommended-${item.key}`}
                      onClick={() => installRecommendedSkill(item)}
                    >
                      {installed ? (enabled ? "Enabled" : "Enable") : "Install"}
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
              No recommended skills are available for this helper&apos;s preset.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle className="text-lg">Install from source</CardTitle>
          <p className="text-sm text-muted-foreground">
            Supported sources: `skills.sh` pages, `agentskills.co.il` skill pages, GitHub repository or tree URLs, local skill folders, and raw `SKILL.md` links.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={installRef}
                onChange={(event) => {
                  setInstallRef(event.target.value);
                  setSaveNotice(undefined);
                }}
                placeholder="https://skills.sh/obra/superpowers/writing-plans"
                className="pl-9"
              />
            </div>
            <Input
              value={installKey}
              onChange={(event) => {
                setInstallKey(event.target.value);
                setSaveNotice(undefined);
              }}
              placeholder="writing-plans (optional)"
              className="sm:max-w-56"
            />
            <Button type="button" variant="outline" onClick={installManualSkillFromUrl}>
              Install source
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function sortInstalledSkillsForDisplay(
  installedSkills: AgentInstalledSkill[],
  enabledSkills: string[]
): AgentInstalledSkill[] {
  const originalIndex = new Map(
    installedSkills.map((skill, index) => [skill.key.toLowerCase(), index] as const)
  );
  const enabledIndex = new Map(
    enabledSkills.map((skill, index) => [skill.toLowerCase(), index] as const)
  );

  return [...installedSkills].sort((left, right) => {
    const leftEnabledIndex = enabledIndex.get(left.key.toLowerCase());
    const rightEnabledIndex = enabledIndex.get(right.key.toLowerCase());
    const leftEnabled = leftEnabledIndex !== undefined;
    const rightEnabled = rightEnabledIndex !== undefined;
    if (leftEnabled && rightEnabled) {
      return (leftEnabledIndex ?? 0) - (rightEnabledIndex ?? 0);
    }
    if (leftEnabled !== rightEnabled) {
      return leftEnabled ? -1 : 1;
    }
    return (originalIndex.get(left.key.toLowerCase()) ?? 0) - (originalIndex.get(right.key.toLowerCase()) ?? 0);
  });
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function areInstalledSkillsEqual(left: AgentInstalledSkill[], right: AgentInstalledSkill[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((skill, index) => {
    const other = right[index];
    return (
      other &&
      skill.key === other.key &&
      skill.ref === other.ref &&
      skill.label === other.label &&
      skill.sourceKind === other.sourceKind
    );
  });
}
