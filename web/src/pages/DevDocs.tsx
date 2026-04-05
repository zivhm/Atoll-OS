import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Download,
  Loader2,
  PencilLine,
  Rows3,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageMotion } from "@/components/layout/PageMotion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  archiveAdminAgentPreset,
  createAdminAgentPreset,
  exportAdminAgentPresets,
  getErrorMessage,
  importAdminAgentPresets,
  listAgentPresets,
  listAdminAgentPresets,
  reorderAdminAgentPresets,
  updateAdminAgentPreset,
  type AgentPreset,
  type AdminAgentPreset,
} from "@/lib/api";
import {
  IDENTITY_COLOR_SWATCHES,
  IDENTITY_COLOR_TOKENS,
  type IdentityColorToken,
} from "@/lib/identity-colors";

type PresetDraft = {
  id: string;
  name: string;
  description: string;
  category: string;
  color: IdentityColorToken;
  summary: string;
  suggestedRoleTitle: string;
  sourceRepoUrl: string;
  sourcePath: string;
  recommendedSkills: string;
  identity: string;
  soul: string;
  tools: string;
  active: boolean;
};

type IdentityEditorControlsProps = {
  selectedPresetId: string;
  setSelectedPresetId: (value: string) => void;
  setPresetDraft: Dispatch<SetStateAction<PresetDraft>>;
  setIsCreatingNewPreset: (value: boolean) => void;
  setIsEditorOpen: (value: boolean) => void;
  presetMutation: ReturnType<typeof useMutation>;
};

const EMPTY_PRESET_DRAFT: PresetDraft = {
  id: "",
  name: "",
  description: "",
  category: "product",
  color: "neutral",
  summary: "",
  suggestedRoleTitle: "",
  sourceRepoUrl: "",
  sourcePath: "",
  recommendedSkills: "",
  identity: "",
  soul: "",
  tools: "",
  active: true,
};

const IDENTITY_CATALOG_VIEW_STORAGE_KEY = "atoll-identity-catalog-view";

export default function DevDocs() {
  const queryClient = useQueryClient();
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [isCreatingNewPreset, setIsCreatingNewPreset] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [presetDraft, setPresetDraft] = useState<PresetDraft>(EMPTY_PRESET_DRAFT);
  const [presetJson, setPresetJson] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [catalogCompact, setCatalogCompact] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(IDENTITY_CATALOG_VIEW_STORAGE_KEY) === "compact";
  });
  const [jsonPanelOpen, setJsonPanelOpen] = useState(false);
  const adminPresetsQuery = useQuery({
    queryKey: ["admin-agent-presets"],
    queryFn: listAdminAgentPresets,
  });
  const fallbackPresetsQuery = useQuery({
    queryKey: ["agent-presets"],
    queryFn: listAgentPresets,
  });

  const fallbackAdminPresets = useMemo(
    () => toAdminPresetFallbacks(fallbackPresetsQuery.data ?? []),
    [fallbackPresetsQuery.data],
  );
  const adminPresets = useMemo(
    () =>
      (adminPresetsQuery.data && adminPresetsQuery.data.length > 0)
        ? adminPresetsQuery.data
        : fallbackAdminPresets,
    [adminPresetsQuery.data, fallbackAdminPresets],
  );
  const isFallbackCatalog =
    (!adminPresetsQuery.data || adminPresetsQuery.data.length === 0) &&
    fallbackAdminPresets.length > 0;
  const isCatalogLoading = adminPresetsQuery.isLoading && fallbackPresetsQuery.isLoading;
  const filteredPresets = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return adminPresets;
    return adminPresets.filter((preset) =>
      [preset.name, preset.summary, preset.category, preset.description].join(" ").toLowerCase().includes(query)
    );
  }, [adminPresets, searchValue]);
  const selectedPreset = adminPresets.find((preset) => preset.id === selectedPresetId);
  const presetOrderIds = useMemo(() => adminPresets.map((preset) => preset.id), [adminPresets]);

  useEffect(() => {
    if (selectedPreset) {
      setPresetDraft(buildPresetDraft(selectedPreset));
    } else if (!selectedPresetId) {
      setPresetDraft(EMPTY_PRESET_DRAFT);
    }
  }, [selectedPreset, selectedPresetId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      IDENTITY_CATALOG_VIEW_STORAGE_KEY,
      catalogCompact ? "compact" : "expanded"
    );
  }, [catalogCompact]);

  const presetMutation = useMutation({
    mutationFn: async (
      action:
        | { type: "create" }
        | { type: "update"; presetId: string }
        | { type: "archive"; presetId: string; archived: boolean }
        | { type: "reorder"; presetIds: string[] }
        | { type: "export" }
        | { type: "import"; replaceExisting: boolean }
    ) => {
      if (action.type === "create") {
        return createAdminAgentPreset({
          id: presetDraft.id || slugifyPresetId(presetDraft.name),
          ...buildPresetPayload(presetDraft),
          position: adminPresets.length,
        });
      }
      if (action.type === "update") {
        return updateAdminAgentPreset(action.presetId, buildPresetPayload(presetDraft));
      }
      if (action.type === "archive") {
        return archiveAdminAgentPreset(action.presetId, action.archived);
      }
      if (action.type === "reorder") {
        return reorderAdminAgentPresets(action.presetIds);
      }
      if (action.type === "export") {
        return exportAdminAgentPresets();
      }
      return importAdminAgentPresets({
        items: parsePresetImportJson(presetJson),
        replaceExisting: action.replaceExisting,
      });
    },
    onSuccess: async (payload, action) => {
      if (action.type === "export") {
        setPresetJson(JSON.stringify(payload, null, 2));
        setJsonPanelOpen(true);
        toast.success("Identity export ready");
        return;
      }

      toast.success("Identity types updated");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-agent-presets"] }),
        queryClient.invalidateQueries({ queryKey: ["agent-presets"] }),
      ]);
      if (action.type === "create" && isAdminAgentPreset(payload)) {
        setIsCreatingNewPreset(false);
        setSelectedPresetId(payload.id);
        setPresetDraft(buildPresetDraft(payload));
        setIsEditorOpen(false);
      }
      if (action.type === "update") {
        setIsEditorOpen(false);
      }
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Identity type action failed"));
    },
  });

  return (
    <PageContainer width="wide" className="space-y-6">
      <PageMotion>
        <PageHeader
          title="Identity Types"
          description="Manage the identity presets catalog."
        />
      </PageMotion>

      {isCatalogLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Loading identity catalog...
          </CardContent>
        </Card>
      ) : null}

      {adminPresetsQuery.isError && fallbackPresetsQuery.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            {getErrorMessage(adminPresetsQuery.error, "Failed to load identity catalog")}
          </CardContent>
        </Card>
      ) : null}

      {isFallbackCatalog ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Showing identity presets from helper setup because the admin preset endpoint did not return items.
          </CardContent>
        </Card>
      ) : null}

      <IdentityTypesSection
        presets={adminPresets}
        filteredPresets={filteredPresets}
        selectedPresetId={selectedPresetId}
        setSelectedPresetId={setSelectedPresetId}
        isCreatingNewPreset={isCreatingNewPreset}
        setIsCreatingNewPreset={setIsCreatingNewPreset}
        isEditorOpen={isEditorOpen}
        setIsEditorOpen={setIsEditorOpen}
        presetDraft={presetDraft}
        setPresetDraft={setPresetDraft}
        presetJson={presetJson}
        setPresetJson={setPresetJson}
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        catalogCompact={catalogCompact}
        setCatalogCompact={setCatalogCompact}
        jsonPanelOpen={jsonPanelOpen}
        setJsonPanelOpen={setJsonPanelOpen}
        presetMutation={presetMutation}
        presetOrderIds={presetOrderIds}
      />
    </PageContainer>
  );
}

function IdentityTypesSection({
  presets,
  filteredPresets,
  selectedPresetId,
  setSelectedPresetId,
  isCreatingNewPreset,
  setIsCreatingNewPreset,
  isEditorOpen,
  setIsEditorOpen,
  presetDraft,
  setPresetDraft,
  presetJson,
  setPresetJson,
  searchValue,
  setSearchValue,
  catalogCompact,
  setCatalogCompact,
  jsonPanelOpen,
  setJsonPanelOpen,
  presetMutation,
  presetOrderIds,
}: {
  presets: AdminAgentPreset[];
  filteredPresets: AdminAgentPreset[];
  selectedPresetId: string;
  setSelectedPresetId: (value: string) => void;
  isCreatingNewPreset: boolean;
  setIsCreatingNewPreset: (value: boolean) => void;
  isEditorOpen: boolean;
  setIsEditorOpen: (value: boolean) => void;
  presetDraft: PresetDraft;
  setPresetDraft: Dispatch<SetStateAction<PresetDraft>>;
  presetJson: string;
  setPresetJson: (value: string) => void;
  searchValue: string;
  setSearchValue: (value: string) => void;
  catalogCompact: boolean;
  setCatalogCompact: (value: boolean) => void;
  jsonPanelOpen: boolean;
  setJsonPanelOpen: (value: boolean) => void;
  presetMutation: ReturnType<typeof useMutation>;
  presetOrderIds: string[];
}) {
  const closeEditor = () => {
    setIsEditorOpen(false);
    if (isCreatingNewPreset) {
      setSelectedPresetId("");
      setPresetDraft(EMPTY_PRESET_DRAFT);
      setIsCreatingNewPreset(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant={isCreatingNewPreset ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => {
                setSelectedPresetId("");
                setPresetDraft(EMPTY_PRESET_DRAFT);
                setIsCreatingNewPreset(true);
                setIsEditorOpen(true);
              }}
            >
              <Sparkles className="h-4 w-4" />
              {isCreatingNewPreset ? "Creating new identity" : "New identity"}
            </Button>
            <Button
              variant={catalogCompact ? "default" : "outline"}
              size="icon"
              aria-label="Compact catalog"
              title="Compact catalog"
              onClick={() => setCatalogCompact(!catalogCompact)}
            >
              <Rows3 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-center">
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search catalog..."
              className="rounded-2xl"
            />
            <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-2 text-sm text-muted-foreground">
              {filteredPresets.length}
            </div>
          </div>
          <ScrollArea className="h-[44rem] pr-3">
            <div className="space-y-3" data-testid="identity-catalog-list">
              {filteredPresets.map((preset, index) => (
                <IdentityCatalogItem
                  key={preset.id}
                  preset={preset}
                  index={index}
                  selectedPresetId={selectedPresetId}
                  setSelectedPresetId={setSelectedPresetId}
                  setPresetDraft={setPresetDraft}
                  setIsCreatingNewPreset={setIsCreatingNewPreset}
                  setIsEditorOpen={setIsEditorOpen}
                  presetMutation={presetMutation}
                  presetOrderIds={presetOrderIds}
                  compact={catalogCompact}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog
        open={isEditorOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsEditorOpen(true);
          } else {
            closeEditor();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden border border-border/80 bg-card p-0 shadow-[0_30px_90px_-45px_hsl(var(--foreground)/0.45)]">
          <DialogHeader className="border-b border-border/70 px-6 py-5">
            <DialogTitle>{selectedPresetId ? "Edit identity type" : "New identity"}</DialogTitle>
            <DialogDescription>
              {selectedPresetId
                ? "Existing identities stay editable with canonical palette tokens."
                : "Fresh drafts start on the shared Atoll palette from the beginning."}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-5.5rem)]">
            <div className="px-6 py-5">
              <IdentityEditorFields
                selectedPresetId={selectedPresetId}
                setSelectedPresetId={setSelectedPresetId}
                setPresetDraft={setPresetDraft}
                setIsCreatingNewPreset={setIsCreatingNewPreset}
                setIsEditorOpen={setIsEditorOpen}
                presetDraft={presetDraft}
                presetMutation={presetMutation}
                onClose={closeEditor}
              />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Collapsible open={jsonPanelOpen} onOpenChange={setJsonPanelOpen}>
        <Card data-testid="identity-json-panel">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>JSON import / export</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Export the catalog, or import an updated snapshot.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="gap-2"
                disabled={presetMutation.isPending}
                onClick={() => void presetMutation.mutateAsync({ type: "export" })}
              >
                <Download className="h-4 w-4" />
                Export snapshot
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Toggle JSON panel">
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${jsonPanelOpen ? "rotate-180" : ""}`}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="rounded-3xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
                Import actions stay inside the expanded panel so you can review the snapshot before applying it.
              </div>

              <Textarea
                value={presetJson}
                onChange={(event) => setPresetJson(event.target.value)}
                rows={16}
                placeholder='{"version":1,"exportedAt":"...","items":[...]}'
              />

              <div className="flex flex-wrap gap-3">
                <Button
                  className="gap-2"
                  disabled={presetMutation.isPending}
                  onClick={() =>
                    void presetMutation.mutateAsync({ type: "import", replaceExisting: true })
                  }
                >
                  Replace from JSON
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={presetMutation.isPending}
                  onClick={() =>
                    void presetMutation.mutateAsync({ type: "import", replaceExisting: false })
                  }
                >
                  Merge from JSON
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

function IdentityEditorFields({
  selectedPresetId,
  setSelectedPresetId,
  setPresetDraft,
  setIsCreatingNewPreset,
  setIsEditorOpen,
  presetDraft,
  presetMutation,
  onClose,
}: IdentityEditorControlsProps & {
  presetDraft: PresetDraft;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      {selectedPresetId ? (
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            setSelectedPresetId("");
            setPresetDraft(EMPTY_PRESET_DRAFT);
            setIsCreatingNewPreset(true);
            setIsEditorOpen(true);
          }}
        >
          <Sparkles className="h-4 w-4" />
          New identity
        </Button>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Preset id">
          <Input
            value={presetDraft.id}
            onChange={(event) =>
              setPresetDraft((current) => ({ ...current, id: event.target.value }))
            }
            placeholder="frontend-developer"
            disabled={Boolean(selectedPresetId)}
          />
        </Field>
        <Field label="Name">
          <Input
            value={presetDraft.name}
            onChange={(event) =>
              setPresetDraft((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Frontend Developer"
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Category">
          <Input
            value={presetDraft.category}
            onChange={(event) =>
              setPresetDraft((current) => ({ ...current, category: event.target.value }))
            }
            placeholder="product"
          />
        </Field>
        <Field label="Color token">
          <div className="grid gap-2 sm:grid-cols-2">
            {IDENTITY_COLOR_TOKENS.map((token) => (
              <button
                key={token}
                type="button"
                className={`rounded-2xl border px-3 py-2 text-left transition ${
                  presetDraft.color === token
                    ? "border-primary/50 bg-primary/10"
                    : "border-border/70 bg-background/70 hover:border-primary/30"
                }`}
                onClick={() =>
                  setPresetDraft((current) => ({ ...current, color: token }))
                }
              >
                <PaletteChip token={token} />
              </button>
            ))}
          </div>
        </Field>
      </div>

      <Field label="Description">
        <Textarea
          value={presetDraft.description}
          onChange={(event) =>
            setPresetDraft((current) => ({ ...current, description: event.target.value }))
          }
          rows={3}
        />
      </Field>
      <Field label="Summary">
        <Textarea
          value={presetDraft.summary}
          onChange={(event) =>
            setPresetDraft((current) => ({ ...current, summary: event.target.value }))
          }
          rows={3}
        />
      </Field>
      <Field label="Suggested role title">
        <Input
          value={presetDraft.suggestedRoleTitle}
          onChange={(event) =>
            setPresetDraft((current) => ({
              ...current,
              suggestedRoleTitle: event.target.value,
            }))
          }
          placeholder="Product prioritizer focused on sprint scope..."
        />
      </Field>

      <Field label="Recommended skills">
        <Textarea
          value={presetDraft.recommendedSkills}
          onChange={(event) =>
            setPresetDraft((current) => ({
              ...current,
              recommendedSkills: event.target.value,
            }))
          }
          rows={5}
          placeholder="https://skills.sh/example/skill-one"
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Source repo URL">
          <Input
            value={presetDraft.sourceRepoUrl}
            onChange={(event) =>
              setPresetDraft((current) => ({
                ...current,
                sourceRepoUrl: event.target.value,
              }))
            }
            placeholder="https://github.com/example/repo"
          />
        </Field>
        <Field label="Source path">
          <Input
            value={presetDraft.sourcePath}
            onChange={(event) =>
              setPresetDraft((current) => ({ ...current, sourcePath: event.target.value }))
            }
            placeholder="product/product-sprint-prioritizer.md"
          />
        </Field>
      </div>

      <label className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/60 px-4 py-3 text-sm">
        <input
          type="checkbox"
          checked={presetDraft.active}
          onChange={(event) =>
            setPresetDraft((current) => ({ ...current, active: event.target.checked }))
          }
        />
        Offer this identity type in `/agents/new`
      </label>

      <Field label="IDENTITY.md">
        <Textarea
          value={presetDraft.identity}
          onChange={(event) =>
            setPresetDraft((current) => ({ ...current, identity: event.target.value }))
          }
          rows={12}
        />
      </Field>
      <Field label="SOUL.md">
        <Textarea
          value={presetDraft.soul}
          onChange={(event) =>
            setPresetDraft((current) => ({ ...current, soul: event.target.value }))
          }
          rows={16}
        />
      </Field>
      <Field label="TOOLS.md">
        <Textarea
          value={presetDraft.tools}
          onChange={(event) =>
            setPresetDraft((current) => ({ ...current, tools: event.target.value }))
          }
          rows={14}
        />
      </Field>

      <div className="flex flex-wrap gap-3">
        <Button
          className="gap-2"
          disabled={presetMutation.isPending}
          onClick={() =>
            void presetMutation.mutateAsync(
              selectedPresetId
                ? { type: "update", presetId: selectedPresetId }
                : { type: "create" }
            )
          }
        >
          {presetMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          {selectedPresetId ? "Save changes" : "Create identity"}
        </Button>
        <Button variant="outline" onClick={onClose}>
          {selectedPresetId ? "Close editor" : "Cancel"}
        </Button>
      </div>
    </div>
  );
}

function IdentityCatalogItem({
  preset,
  index,
  selectedPresetId,
  setSelectedPresetId,
  setPresetDraft,
  setIsCreatingNewPreset,
  setIsEditorOpen,
  presetMutation,
  presetOrderIds,
  compact,
}: IdentityEditorControlsProps & {
  preset: AdminAgentPreset;
  index: number;
  presetOrderIds: string[];
  compact: boolean;
}) {
  const selectPreset = () => {
    setSelectedPresetId(preset.id);
    setPresetDraft(buildPresetDraft(preset));
    setIsCreatingNewPreset(false);
    setIsEditorOpen(true);
  };

  if (compact) {
    return (
      <div
        data-testid={`identity-item-${preset.id}`}
        data-layout="compact"
        className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <PaletteChip token={preset.color as IdentityColorToken} compact />
            <p className="truncate text-sm font-semibold text-foreground">{preset.name}</p>
            <p className="truncate text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {formatPresetCategory(preset.category)} · {preset.active ? "Active" : "Archived"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              disabled={presetMutation.isPending || index === 0}
              onClick={() =>
                void presetMutation.mutateAsync({
                  type: "reorder",
                  presetIds: movePreset(presetOrderIds, preset.id, -1),
                })
              }
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={presetMutation.isPending || index === presetOrderIds.length - 1}
              onClick={() =>
                void presetMutation.mutateAsync({
                  type: "reorder",
                  presetIds: movePreset(presetOrderIds, preset.id, 1),
                })
              }
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              variant={selectedPresetId === preset.id ? "default" : "outline"}
              size="sm"
              onClick={selectPreset}
            >
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={presetMutation.isPending}
              onClick={() =>
                void presetMutation.mutateAsync({
                  type: "archive",
                  presetId: preset.id,
                  archived: preset.active,
                })
              }
            >
              {preset.active ? "Archive" : "Restore"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid={`identity-item-${preset.id}`}
      data-layout="expanded"
      className="rounded-3xl border border-border/70 bg-background/70 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <PaletteChip token={preset.color as IdentityColorToken} compact />
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {formatPresetCategory(preset.category)} · {preset.active ? "Active" : "Archived"}
            </p>
          </div>
          <p className="text-lg font-semibold">{preset.name}</p>
          <p className="text-sm text-muted-foreground">{preset.summary}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            disabled={presetMutation.isPending || index === 0}
            onClick={() =>
              void presetMutation.mutateAsync({
                type: "reorder",
                presetIds: movePreset(presetOrderIds, preset.id, -1),
              })
            }
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            disabled={presetMutation.isPending || index === presetOrderIds.length - 1}
            onClick={() =>
              void presetMutation.mutateAsync({
                type: "reorder",
                presetIds: movePreset(presetOrderIds, preset.id, 1),
              })
            }
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={selectPreset}>
            <PencilLine className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant={selectedPresetId === preset.id ? "default" : "outline"}
          size="sm"
          onClick={selectPreset}
        >
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={presetMutation.isPending}
          onClick={() =>
            void presetMutation.mutateAsync({
              type: "archive",
              presetId: preset.id,
              archived: preset.active,
            })
          }
        >
          {preset.active ? "Archive" : "Restore"}
        </Button>
      </div>
    </div>
  );
}

function PaletteChip({
  token,
  compact = false,
}: {
  token: IdentityColorToken;
  compact?: boolean;
}) {
  const swatch = IDENTITY_COLOR_SWATCHES[token];
  return (
    <div className={`flex items-center gap-2 ${compact ? "text-xs" : "text-sm"}`}>
      <span
        className="inline-flex h-4 w-4 rounded-full border border-white/40"
        style={{ backgroundColor: swatch.accent }}
      />
      <span className="font-medium">{swatch.label}</span>
      <span className="text-muted-foreground">{token}</span>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label className="mb-2 block text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

function buildPresetDraft(preset: AdminAgentPreset): PresetDraft {
  return {
    id: preset.id,
    name: preset.name,
    description: preset.description,
    category: preset.category,
    color: preset.color as IdentityColorToken,
    summary: preset.summary,
    suggestedRoleTitle: preset.suggestedRoleTitle,
    sourceRepoUrl: preset.sourceRepoUrl ?? "",
    sourcePath: preset.sourcePath ?? "",
    recommendedSkills: preset.recommendedSkills.join("\n"),
    identity: preset.identity,
    soul: preset.soul,
    tools: preset.tools,
    active: preset.active,
  };
}

function buildPresetPayload(draft: PresetDraft) {
  return {
    name: draft.name,
    description: draft.description,
    color: draft.color,
    category: draft.category,
    sourceRepoUrl: draft.sourceRepoUrl || undefined,
    sourcePath: draft.sourcePath || undefined,
    summary: draft.summary,
    suggestedRoleTitle: draft.suggestedRoleTitle,
    recommendedSkills: parseRecommendedSkillsInput(draft.recommendedSkills),
    identity: draft.identity,
    soul: draft.soul,
    tools: draft.tools,
    active: draft.active,
  };
}

function slugifyPresetId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function movePreset(ids: string[], presetId: string, delta: -1 | 1): string[] {
  const index = ids.findIndex((value) => value === presetId);
  const nextIndex = index + delta;
  if (index === -1 || nextIndex < 0 || nextIndex >= ids.length) {
    return ids;
  }
  const reordered = [...ids];
  const [item] = reordered.splice(index, 1);
  if (!item) return ids;
  reordered.splice(nextIndex, 0, item);
  return reordered;
}

function parsePresetImportJson(raw: string): Array<Omit<AdminAgentPreset, "createdAt" | "updatedAt">> {
  const parsed = JSON.parse(raw) as { items?: unknown } | unknown[];
  if (Array.isArray(parsed)) {
    return parsed as Array<Omit<AdminAgentPreset, "createdAt" | "updatedAt">>;
  }
  if (Array.isArray(parsed.items)) {
    return parsed.items as Array<Omit<AdminAgentPreset, "createdAt" | "updatedAt">>;
  }
  return [];
}

function formatPresetCategory(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseRecommendedSkillsInput(value: string): string[] {
  return value
    .split(/[\n,]/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toAdminPresetFallbacks(presets: AgentPreset[]): AdminAgentPreset[] {
  const timestamp = new Date(0).toISOString();
  return presets.map((preset) => ({
    ...preset,
    identity: "",
    soul: "",
    tools: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

function isAdminAgentPreset(value: unknown): value is AdminAgentPreset {
  if (!value || typeof value !== "object") {
    return false;
  }
  return typeof (value as { id?: unknown }).id === "string";
}
