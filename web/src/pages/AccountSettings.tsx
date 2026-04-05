import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, RotateCcw, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageMotion } from "@/components/layout/PageMotion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import {
  getErrorMessage,
  getSettingsConfig,
  type SettingsConfigField,
  type SettingsConfigSnapshot,
  updateSettingsConfig,
} from "@/lib/api";

type ConfigValues = Record<string, string | boolean>;

const EMPTY_SELECT_VALUE = "__atoll-empty__";
const AI_DEFAULT_KEYS = [
  "RUNTIME_PROVIDER",
  "RUNTIME_MODEL",
  "ATOLL_LLM_PROVIDER_API_KEY",
] as const;

export default function AccountSettings() {
  const queryClient = useQueryClient();
  const { refresh, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [draftValues, setDraftValues] = useState<ConfigValues>({});
  const settingsConfigQuery = useQuery({
    queryKey: ["settings-config"],
    queryFn: getSettingsConfig,
  });

  useEffect(() => {
    if (settingsConfigQuery.data) {
      setDraftValues(extractEditableConfigValues(settingsConfigQuery.data));
    }
  }, [settingsConfigQuery.data]);

  const configMutation = useMutation({
    mutationFn: async () => updateSettingsConfig({ values: draftValues }),
    onSuccess: (snapshot) => {
      queryClient.setQueryData(["settings-config"], snapshot);
      setDraftValues(extractEditableConfigValues(snapshot));
      toast.success("AI defaults saved to .env");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to save AI defaults"));
    },
  });

  const aiDefaults = useMemo(
    () => getEditableFields(settingsConfigQuery.data),
    [settingsConfigQuery.data],
  );
  const configDirty = useMemo(() => {
    if (!settingsConfigQuery.data) {
      return false;
    }
    return hasConfigChanges(extractEditableConfigValues(settingsConfigQuery.data), draftValues);
  }, [draftValues, settingsConfigQuery.data]);

  return (
    <PageContainer width="narrow" className="space-y-6 pb-10">
      <PageMotion>
        <PageHeader
          eyebrow="Preferences"
          title="Settings"
          description="Manage local preferences, AI defaults, and session history actions."
        />
      </PageMotion>

      <div className="space-y-4">
        <SettingsCard
          title="General"
          description="Manage local display and workspace preferences."
        >
          <div className="space-y-2">
            <Label htmlFor="theme-select" className="text-sm font-medium text-foreground">
              Theme
            </Label>
            <Select
              value={theme}
              onValueChange={(value) => {
                if (value === "light" || value === "dark") {
                  setTheme(value);
                }
              }}
            >
              <SelectTrigger id="theme-select" aria-label="Theme mode">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Light mode is fully supported. Theme preference is saved locally.
            </p>
          </div>
        </SettingsCard>

        <SettingsCard
          title="AI defaults"
          description="Define default model credentials and prompt behavior for new sessions."
        >
          {settingsConfigQuery.data?.restartRequired ? (
            <div className="rounded-[16px] border border-amber-500/20 bg-amber-500/8 p-4 text-sm">
              <p className="font-medium text-foreground">Restart required</p>
              <p className="mt-1 text-muted-foreground">
                {settingsConfigQuery.data.restartMessage ??
                  "Saved values update the repo-root .env. Restart the API to fully apply them."}
              </p>
              <p className="mt-2 text-muted-foreground">
                {settingsConfigQuery.data.warning ??
                  "Runtime config precedence is unchanged: external process env vars still win over .env at startup."}
              </p>
            </div>
          ) : null}

          {settingsConfigQuery.isLoading ? (
            <div className="rounded-[16px] border border-border/70 bg-background/60 px-4 py-6 text-sm text-muted-foreground">
              Loading AI defaults...
            </div>
          ) : settingsConfigQuery.error ? (
            <div className="rounded-[16px] border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
              {getErrorMessage(settingsConfigQuery.error, "Failed to load AI defaults")}
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {aiDefaults.map((field) => (
                  <SettingsFieldControl
                    key={field.key}
                    field={field}
                    value={draftValues[field.key]}
                    onChange={(value) =>
                      setDraftValues((current) => ({
                        ...current,
                        [field.key]: value,
                      }))
                    }
                  />
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  className="gap-2 rounded-2xl"
                  disabled={!configDirty || configMutation.isPending}
                  onClick={() => void configMutation.mutateAsync()}
                >
                  {configMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Settings2 className="h-4 w-4" />
                  )}
                  Save changes
                </Button>
                <Button
                  variant="ghost"
                  className="rounded-2xl"
                  disabled={!configDirty || configMutation.isPending}
                  onClick={() =>
                    settingsConfigQuery.data
                      ? setDraftValues(extractEditableConfigValues(settingsConfigQuery.data))
                      : undefined
                  }
                >
                  Reset
                </Button>
              </div>
            </>
          )}
        </SettingsCard>

        <SettingsCard
          title="History"
          description="Refresh auth state or reload the app to clear stale local session state."
        >
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              className="gap-2 rounded-2xl"
              onClick={async () => {
                await refresh();
                toast.success("Session refreshed");
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh session
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2 rounded-2xl"
              onClick={async () => {
                await signOut();
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Reload app
            </Button>
          </div>
        </SettingsCard>
      </div>
    </PageContainer>
  );
}

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-[24px] border border-border/80 bg-card p-5 sm:p-6">
      <div>
        <p className="text-lg font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function SettingsFieldControl({
  field,
  value,
  onChange,
}: {
  field: SettingsConfigField;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
}) {
  const stringValue = typeof value === "string" ? value : String(field.value ?? "");
  const isSecretField = field.key.includes("API_KEY");

  return (
    <div className="rounded-[18px] border border-border/70 bg-background/50 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Label className="text-sm font-medium">{field.label}</Label>
        <FieldSourceBadge source={field.source} />
      </div>

      {field.kind === "select" && field.options ? (
        <Select
          value={stringValue === "" ? EMPTY_SELECT_VALUE : stringValue}
          onValueChange={(nextValue) =>
            onChange(nextValue === EMPTY_SELECT_VALUE ? "" : nextValue)
          }
        >
          <SelectTrigger aria-label={field.label}>
            <SelectValue placeholder={field.placeholder || "Select a value"} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem
                key={option.value || EMPTY_SELECT_VALUE}
                value={option.value === "" ? EMPTY_SELECT_VALUE : option.value}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          type={isSecretField ? "password" : "text"}
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          aria-label={field.label}
        />
      )}

      <p className="mt-2 text-sm text-muted-foreground">{field.helpText}</p>
    </div>
  );
}

function FieldSourceBadge({ source }: { source: "env" | "default" }) {
  return (
    <span className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
      {source === "env" ? "From .env" : "Built-in default"}
    </span>
  );
}

function getEditableFields(snapshot?: SettingsConfigSnapshot): SettingsConfigField[] {
  if (!snapshot) {
    return [];
  }

  const editableFields = snapshot.groups
    .flatMap((group) => group.fields)
    .filter((field) => AI_DEFAULT_KEYS.includes(field.key as (typeof AI_DEFAULT_KEYS)[number]));

  return AI_DEFAULT_KEYS.flatMap((key) => editableFields.find((field) => field.key === key) ?? []);
}

function extractEditableConfigValues(snapshot: SettingsConfigSnapshot): ConfigValues {
  return Object.fromEntries(
    getEditableFields(snapshot).map((field) => [field.key, field.value]),
  );
}

function hasConfigChanges(current: ConfigValues, draft: ConfigValues): boolean {
  const keys = new Set([...Object.keys(current), ...Object.keys(draft)]);
  for (const key of keys) {
    if (current[key] !== draft[key]) {
      return true;
    }
  }
  return false;
}
