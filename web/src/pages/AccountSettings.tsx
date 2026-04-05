import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, RotateCcw, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { ThemeToggle } from "@/components/ThemeToggle";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageMotion } from "@/components/layout/PageMotion";
import { Section } from "@/components/layout/Section";
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
    <PageContainer width="wide" className="space-y-6">
      <PageMotion>
        <PageHeader
          eyebrow="Preferences"
          title="Settings"
          description="Manage your local theme, session actions, and default AI configuration."
        />
      </PageMotion>

      <div className="space-y-6">
        <Section title="Preferences">
          <div className="rounded-[28px] border border-border/80 bg-card px-6 py-6">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="text-[1.05rem] font-semibold text-foreground">Theme</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Toggle between light and dark mode.
                </p>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </Section>

        <Section title="AI defaults">
          <div className="space-y-4 rounded-[28px] border border-border/80 bg-card p-5">
            {settingsConfigQuery.data?.restartRequired ? (
              <div className="rounded-[20px] border border-amber-500/20 bg-amber-500/8 p-4 text-sm">
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
              <div className="rounded-[20px] border border-border/70 bg-background/60 px-4 py-6 text-sm text-muted-foreground">
                Loading AI defaults...
              </div>
            ) : settingsConfigQuery.error ? (
              <div className="rounded-[20px] border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
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
                    Save AI defaults
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    disabled={!configDirty || configMutation.isPending}
                    onClick={() =>
                      settingsConfigQuery.data
                        ? setDraftValues(extractEditableConfigValues(settingsConfigQuery.data))
                        : undefined
                    }
                  >
                    Reset changes
                  </Button>
                </div>
              </>
            )}
          </div>
        </Section>

        <Section title="Session actions">
          <div className="space-y-4 rounded-[28px] border border-border/80 bg-card px-6 py-6">
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Account and session actions</p>
              <p className="mt-2">
                Refresh the local auth session if something looks stale, or reload the app after changes.
              </p>
            </div>
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
          </div>
        </Section>
      </div>
    </PageContainer>
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
