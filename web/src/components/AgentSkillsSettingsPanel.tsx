import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Search, Trash2 } from "lucide-react";

import type {
  Agent,
  AgentInstalledSkill,
  AgentSkillCatalogItem,
  UpdateAgentResponse
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
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

type CatalogFilter = "all" | "preset";
type CatalogView = "list" | "gallery";
const CATALOG_PAGE_SIZE = 15;

type ExploreSource = {
  id: string;
  label: string;
  description: string;
  url: string;
};

export function AgentSkillsSettingsPanel({
  agent,
  catalogItems,
  savePending = false,
  onSave
}: AgentSkillsSettingsPanelProps) {
  const [installedSkills, setInstalledSkills] = useState<AgentInstalledSkill[]>(agent.installedSkills);
  const [enabledSkills, setEnabledSkills] = useState<string[]>(agent.skills);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>("all");
  const [catalogView, setCatalogView] = useState<CatalogView>("list");
  const [catalogSourceFilter, setCatalogSourceFilter] = useState("all");
  const [catalogPage, setCatalogPage] = useState(1);
  const [saveNotice, setSaveNotice] = useState<SaveNotice | undefined>(undefined);

  useEffect(() => {
    setInstalledSkills(agent.installedSkills);
    setEnabledSkills(agent.skills);
    setSaveNotice(undefined);
  }, [agent.id, agent.installedSkills, agent.skills]);

  const installedKeySet = useMemo(
    () => new Set(installedSkills.map((skill) => skill.key.toLowerCase())),
    [installedSkills]
  );
  const catalogByKey = useMemo(
    () => new Map(catalogItems.map((item) => [item.key.toLowerCase(), item] as const)),
    [catalogItems]
  );

  const browseItems = useMemo(() => {
    const query = catalogQuery.trim().toLowerCase();
    const filtered = catalogItems.filter((item) => {
      const key = item.key.toLowerCase();
      const installed = installedKeySet.has(key);

      if (installed) {
        return false;
      }

      if (catalogFilter === "preset" && !item.recommendedForCurrentPreset) {
        return false;
      }
      if (catalogSourceFilter !== "all" && item.sourceHost.toLowerCase() !== catalogSourceFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        item.label,
        item.key,
        item.summary,
        item.provider,
        item.sourceHost,
        ...item.originCategories,
        ...item.sourcePresets.map((preset) => preset.presetName)
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });

    return filtered.sort((left, right) => {
      if (left.recommendedForCurrentPreset !== right.recommendedForCurrentPreset) {
        return left.recommendedForCurrentPreset ? -1 : 1;
      }

      return left.label.localeCompare(right.label);
    });
  }, [catalogItems, catalogFilter, catalogQuery, catalogSourceFilter, installedKeySet]);

  const catalogSourceOptions = useMemo(
    () =>
      [...new Set(catalogItems.map((item) => item.sourceHost.toLowerCase()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [catalogItems]
  );

  const catalogPageCount = Math.max(1, Math.ceil(browseItems.length / CATALOG_PAGE_SIZE));
  const paginatedBrowseItems = useMemo(() => {
    const normalizedPage = Math.max(1, Math.min(catalogPage, catalogPageCount));
    const start = (normalizedPage - 1) * CATALOG_PAGE_SIZE;
    return browseItems.slice(start, start + CATALOG_PAGE_SIZE);
  }, [browseItems, catalogPage, catalogPageCount]);

  useEffect(() => {
    setCatalogPage(1);
  }, [catalogQuery, catalogFilter, catalogSourceFilter]);

  useEffect(() => {
    if (catalogPage > catalogPageCount) {
      setCatalogPage(catalogPageCount);
    }
  }, [catalogPage, catalogPageCount]);

  const exploreSources = useMemo(() => buildExploreSources(catalogItems), [catalogItems]);

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

  function installCatalogSkill(item: AgentSkillCatalogItem) {
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

  function activateCatalogFilter(nextFilter: CatalogFilter) {
    setCatalogFilter(nextFilter);
    if (nextFilter === "all") {
      setCatalogSourceFilter("all");
    }
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
                const presetOrigins = catalogByKey
                  .get(skill.key.toLowerCase())
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
        <CardHeader className="flex flex-col gap-3 border-b border-border/70 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">Browse skills catalog</CardTitle>
            <p className="text-sm text-muted-foreground">
              Browse the curated catalog across all identities, then install new skills directly.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterButton
              selected={catalogView === "list"}
              onClick={() => setCatalogView("list")}
              data-testid="catalog-view-list"
            >
              List
            </FilterButton>
            <FilterButton
              selected={catalogView === "gallery"}
              onClick={() => setCatalogView("gallery")}
              data-testid="catalog-view-gallery"
            >
              Gallery
            </FilterButton>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={catalogQuery}
                onChange={(event) => setCatalogQuery(event.target.value)}
                placeholder="Search by skill name, key, source, or description"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterButton
                selected={catalogFilter === "all"}
                onClick={() => activateCatalogFilter("all")}
                data-testid="catalog-filter-all"
              >
                All
              </FilterButton>
              <FilterButton
                selected={catalogFilter === "preset"}
                onClick={() => activateCatalogFilter("preset")}
                data-testid="catalog-filter-preset"
              >
                Preset matches
              </FilterButton>
            </div>
            <Select value={catalogSourceFilter} onValueChange={setCatalogSourceFilter}>
              <SelectTrigger className="min-w-44">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {catalogSourceOptions.map((source) => (
                  <SelectItem key={source} value={source}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {browseItems.length > 0 ? (
            <>
              <div
                className={
                  catalogView === "gallery"
                    ? "grid auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-3"
                    : "space-y-3"
                }
                data-testid={catalogView === "gallery" ? "catalog-results-gallery" : "catalog-results-list"}
              >
                {paginatedBrowseItems.map((item) => {
                  return (
                    <div
                      key={item.key}
                      data-testid={`catalog-skill-${item.key}`}
                      className={`rounded-2xl border border-border/70 bg-background/70 p-4 ${
                        catalogView === "gallery" ? "h-full" : ""
                      }`}
                    >
                      {catalogView === "gallery" ? (
                        <div className="flex h-full flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium leading-tight">{item.label}</p>
                            {item.recommendedForCurrentPreset ? (
                              <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                                Preset match
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-border/70 px-2 py-0.5 text-xs text-muted-foreground">
                              {item.key}
                            </span>
                            <span className="rounded-full border border-border/70 px-2 py-0.5 text-xs text-muted-foreground">
                              {item.sourceHost}
                            </span>
                          </div>
                          <p
                            className="mt-3 min-h-24 line-clamp-4 text-sm leading-6 text-muted-foreground"
                            title={item.summary || "No description available."}
                          >
                            {item.summary || "No description available."}
                          </p>
                          <p
                            className="mt-2 min-h-10 line-clamp-2 break-all text-xs text-muted-foreground"
                            title={item.ref}
                          >
                            {item.ref}
                          </p>
                          <Button
                            type="button"
                            variant="default"
                            className="mt-4 w-full"
                            data-testid={`install-catalog-${item.key}`}
                            onClick={() => installCatalogSkill(item)}
                          >
                            Install
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium leading-tight">{item.label}</p>
                              <span className="rounded-full border border-border/70 px-2 py-0.5 text-xs text-muted-foreground">
                                {item.key}
                              </span>
                              <span className="rounded-full border border-border/70 px-2 py-0.5 text-xs text-muted-foreground">
                                {item.sourceHost}
                              </span>
                              {item.recommendedForCurrentPreset ? (
                                <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                                  Preset match
                                </span>
                              ) : null}
                            </div>
                            {item.summary ? <p className="text-sm text-muted-foreground">{item.summary}</p> : null}
                            <p className="break-all text-xs text-muted-foreground">{item.ref}</p>
                          </div>
                          <Button
                            type="button"
                            variant="default"
                            data-testid={`install-catalog-${item.key}`}
                            onClick={() => installCatalogSkill(item)}
                          >
                            Install
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {catalogPageCount > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    Showing {(catalogPage - 1) * CATALOG_PAGE_SIZE + 1}-
                    {Math.min(catalogPage * CATALOG_PAGE_SIZE, browseItems.length)} of {browseItems.length}
                  </p>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={catalogPage <= 1}
                      onClick={() => setCatalogPage((current) => Math.max(1, current - 1))}
                      data-testid="catalog-page-prev"
                    >
                      Prev
                    </Button>
                    {buildPaginationWindow(catalogPage, catalogPageCount).map((value, index) =>
                      value === "ellipsis" ? (
                        <span key={`${value}-${index}`} className="px-1 text-muted-foreground">
                          ...
                        </span>
                      ) : (
                        <Button
                          key={`catalog-page-${value}`}
                          type="button"
                          variant={value === catalogPage ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCatalogPage(value)}
                          data-testid={`catalog-page-${value}`}
                        >
                          {value}
                        </Button>
                      )
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={catalogPage >= catalogPageCount}
                      onClick={() => setCatalogPage((current) => Math.min(catalogPageCount, current + 1))}
                      data-testid="catalog-page-next"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
              No skills matched your current filters.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle className="text-lg">Explore sources</CardTitle>
          <p className="text-sm text-muted-foreground">
            Browse root source directories by base URL.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 p-6">
          {exploreSources.map((source) => (
            <div
              key={source.id}
              data-testid={`explore-source-${source.id}`}
              className="rounded-2xl border border-border/70 bg-background/70 p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <p className="font-medium">{source.label}</p>
                  <p className="text-sm text-muted-foreground">{source.description}</p>
                  <p className="break-all text-xs text-muted-foreground">{source.url}</p>
                </div>
                <Button type="button" variant="outline" size="sm" asChild>
                  <a href={source.url} target="_self" rel="noreferrer">
                    Open
                  </a>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function FilterButton({
  children,
  selected,
  onClick,
  "data-testid": dataTestId
}: {
  children: string;
  selected: boolean;
  onClick: () => void;
  "data-testid"?: string;
}) {
  return (
    <Button
      type="button"
      variant={selected ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      data-testid={dataTestId}
    >
      {children}
    </Button>
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

function buildExploreSources(catalogItems: AgentSkillCatalogItem[]): ExploreSource[] {
  const byHost = new Map<string, ExploreSource>();
  const defaultHosts = [SKILLS_SH_HOST, AGENTSKILLS_HOST];

  for (const host of defaultHosts) {
    byHost.set(host, createExploreSourceFromHost(host));
  }

  for (const item of catalogItems) {
    const host = item.sourceHost.trim().toLowerCase();
    if (!isBrowsableSourceHost(host) || byHost.has(host)) {
      continue;
    }
    byHost.set(host, createExploreSourceFromHost(host));
  }

  return [...byHost.values()].sort((left, right) => left.label.localeCompare(right.label));
}

function buildPaginationWindow(currentPage: number, pageCount: number): Array<number | "ellipsis"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis", pageCount];
  }

  if (currentPage >= pageCount - 3) {
    return [1, "ellipsis", pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount];
  }

  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", pageCount];
}

const SKILLS_SH_HOST = "skills.sh";
const AGENTSKILLS_HOST = "agentskills.co.il";

function isBrowsableSourceHost(host: string): boolean {
  if (!host || host === "local" || host === "remote") {
    return false;
  }
  return host.includes(".");
}

function createExploreSourceFromHost(host: string): ExploreSource {
  if (host === SKILLS_SH_HOST) {
    return {
      id: "skills-sh",
      label: SKILLS_SH_HOST,
      description: "Global skills directory.",
      url: "https://skills.sh"
    };
  }
  if (host === AGENTSKILLS_HOST) {
    return {
      id: "agentskills-co-il",
      label: AGENTSKILLS_HOST,
      description: "Skills IL directory.",
      url: "https://agentskills.co.il/en/skills"
    };
  }

  const sanitizedHostId = host.replace(/[^a-z0-9-]+/giu, "-");
  return {
    id: `host-${sanitizedHostId}`,
    label: host,
    description: "Source directory.",
    url: `https://${host}`
  };
}
