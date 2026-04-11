import type { ReactNode } from "react";

import type { IntegrationSettingsCardProps } from "@/components/IntegrationSettingsCard";
import { IntegrationSettingsCard } from "@/components/IntegrationSettingsCard";
import { LabeledField } from "@/components/LabeledField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const TELEGRAM_ALLOW_LIST_HINT =
  "Use numeric user IDs for reliability. `*` allows anyone to message this helper.";

export const SLACK_SETUP_BOT_SCOPES = [
  "app_mentions:read",
  "chat:write",
  "im:history",
  "channels:read",
  "groups:read",
  "mpim:read",
  "im:read",
  "users:read",
] as const;

export const SLACK_SETUP_APP_SCOPES = ["connections:write"] as const;

type IntegrationCardProps = Pick<
  IntegrationSettingsCardProps,
  | "enabled"
  | "onEnabledChange"
  | "summary"
  | "saveLabel"
  | "saveDisabled"
  | "saveIcon"
  | "onSave"
  | "alwaysVisibleContent"
>;

export function TelegramIntegrationCard({
  enabled,
  onEnabledChange,
  summary,
  saveLabel,
  saveDisabled,
  saveIcon,
  onSave,
  tokenField,
  allowListValue,
  onAllowListChange,
  allowListWarnings = [],
  showReplyInPrivate,
  replyInPrivate,
  onReplyInPrivateChange,
}: IntegrationCardProps & {
  tokenField?: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
  };
  allowListValue?: string;
  onAllowListChange?: (value: string) => void;
  allowListWarnings?: string[];
  showReplyInPrivate?: boolean;
  replyInPrivate?: boolean;
  onReplyInPrivateChange?: (value: boolean) => void;
}) {
  return (
    <IntegrationSettingsCard
      title="Telegram"
      category=""
      monogram="TG"
      accentBarClassName="from-sky-500/80 via-cyan-500/70 to-emerald-400/70"
      accentBadgeClassName="border-sky-300/40 bg-sky-500/15 text-sky-800 dark:border-sky-500/30 dark:text-sky-200"
      enabled={enabled}
      onEnabledChange={onEnabledChange}
      summary={summary}
      saveLabel={saveLabel}
      saveDisabled={saveDisabled}
      saveIcon={saveIcon}
      onSave={onSave}
    >
      {tokenField ? (
        <LabeledField label="Telegram token">
          <Input
            type="password"
            value={tokenField.value}
            onChange={(event) => tokenField.onChange(event.target.value)}
            placeholder={tokenField.placeholder}
          />
        </LabeledField>
      ) : null}

      {allowListValue !== undefined && onAllowListChange ? (
        <LabeledField label="Allowed users/chats">
          <Textarea
            value={allowListValue}
            onChange={(event) => onAllowListChange(event.target.value)}
            rows={4}
            placeholder="123456789, @trusteduser, *"
          />
          <p className="mt-2 text-xs text-muted-foreground">{TELEGRAM_ALLOW_LIST_HINT}</p>
          {allowListWarnings.length > 0 ? (
            <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {allowListWarnings.join(" ")}
            </div>
          ) : null}
        </LabeledField>
      ) : null}

      {showReplyInPrivate ? (
        <ChannelBehaviorToggle
          title="Reply in private"
          description="Send replies as private messages when possible."
          ariaLabel="Reply in private"
          checked={Boolean(replyInPrivate)}
          onCheckedChange={onReplyInPrivateChange}
        />
      ) : null}
    </IntegrationSettingsCard>
  );
}

export function SlackIntegrationCard({
  enabled,
  onEnabledChange,
  summary,
  saveLabel,
  saveDisabled,
  saveIcon,
  onSave,
  alwaysVisibleContent,
  botToken,
  onBotTokenChange,
  botTokenPlaceholder,
  appToken,
  onAppTokenChange,
  appTokenPlaceholder,
  showAppToken,
  allowedChannelIds,
  onAllowedChannelIdsChange,
  showAllowedChannelIds,
  allowedUserIds,
  onAllowedUserIdsChange,
  showAllowedUserIds,
  replyInThread,
  onReplyInThreadChange,
  showReplyInThread,
}: IntegrationCardProps & {
  botToken: string;
  onBotTokenChange: (value: string) => void;
  botTokenPlaceholder: string;
  appToken: string;
  onAppTokenChange: (value: string) => void;
  appTokenPlaceholder: string;
  showAppToken?: boolean;
  allowedChannelIds: string;
  onAllowedChannelIdsChange: (value: string) => void;
  showAllowedChannelIds?: boolean;
  allowedUserIds: string;
  onAllowedUserIdsChange: (value: string) => void;
  showAllowedUserIds?: boolean;
  replyInThread: boolean;
  onReplyInThreadChange: (value: boolean) => void;
  showReplyInThread?: boolean;
}) {
  return (
    <IntegrationSettingsCard
      title="Slack"
      category=""
      monogram="SL"
      accentBarClassName="from-fuchsia-500/80 via-rose-500/70 to-amber-400/70"
      accentBadgeClassName="border-fuchsia-300/40 bg-fuchsia-500/15 text-fuchsia-800 dark:border-fuchsia-500/30 dark:text-fuchsia-200"
      enabled={enabled}
      onEnabledChange={onEnabledChange}
      summary={summary}
      saveLabel={saveLabel}
      saveDisabled={saveDisabled}
      saveIcon={saveIcon}
      onSave={onSave}
      alwaysVisibleContent={alwaysVisibleContent}
    >
      <LabeledField label="Bot token">
        <Input
          type="password"
          value={botToken}
          onChange={(event) => onBotTokenChange(event.target.value)}
          placeholder={botTokenPlaceholder}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Slack app settings: OAuth &amp; Permissions → Bot User OAuth Token.
        </p>
      </LabeledField>

      {showAppToken !== false ? (
      <LabeledField label="App token">
        <Input
          type="password"
          value={appToken}
          onChange={(event) => onAppTokenChange(event.target.value)}
          placeholder={appTokenPlaceholder}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Slack app settings: Basic Information → App-Level Tokens (`connections:write`).
        </p>
      </LabeledField>
      ) : null}

      {showAllowedChannelIds !== false ? (
      <LabeledField label="Allowed channel IDs">
        <Textarea
          value={allowedChannelIds}
          onChange={(event) => onAllowedChannelIdsChange(event.target.value)}
          rows={3}
          placeholder="C1234567890, D1234567890"
        />
      </LabeledField>
      ) : null}

      {showAllowedUserIds !== false ? (
      <LabeledField label="Allowed user IDs">
        <Textarea
          value={allowedUserIds}
          onChange={(event) => onAllowedUserIdsChange(event.target.value)}
          rows={3}
          placeholder="U1234567890"
        />
      </LabeledField>
      ) : null}

      {showReplyInThread !== false ? (
      <ChannelBehaviorToggle
        title="Reply in thread"
        description="Reply in the originating Slack thread when possible."
        ariaLabel="Reply in Slack thread"
        checked={replyInThread}
        onCheckedChange={onReplyInThreadChange}
      />
      ) : null}
    </IntegrationSettingsCard>
  );
}

export function DiscordIntegrationCard({
  enabled,
  onEnabledChange,
  summary,
  saveLabel,
  saveDisabled,
  saveIcon,
  onSave,
  botToken,
  onBotTokenChange,
  botTokenPlaceholder,
  allowedGuildIds,
  onAllowedGuildIdsChange,
  showAllowedGuildIds,
  allowedChannelIds,
  onAllowedChannelIdsChange,
  showAllowedChannelIds,
  replyInThread,
  onReplyInThreadChange,
  showReplyInThread,
}: IntegrationCardProps & {
  botToken: string;
  onBotTokenChange: (value: string) => void;
  botTokenPlaceholder: string;
  allowedGuildIds: string;
  onAllowedGuildIdsChange: (value: string) => void;
  showAllowedGuildIds?: boolean;
  allowedChannelIds: string;
  onAllowedChannelIdsChange: (value: string) => void;
  showAllowedChannelIds?: boolean;
  replyInThread: boolean;
  onReplyInThreadChange: (value: boolean) => void;
  showReplyInThread?: boolean;
}) {
  return (
    <IntegrationSettingsCard
      title="Discord"
      category=""
      monogram="DS"
      accentBarClassName="from-indigo-500/80 via-violet-500/70 to-blue-400/70"
      accentBadgeClassName="border-indigo-300/40 bg-indigo-500/15 text-indigo-800 dark:border-indigo-500/30 dark:text-indigo-200"
      enabled={enabled}
      onEnabledChange={onEnabledChange}
      summary={summary}
      saveLabel={saveLabel}
      saveDisabled={saveDisabled}
      saveIcon={saveIcon}
      onSave={onSave}
    >
      <LabeledField label="Bot token">
        <Input
          type="password"
          value={botToken}
          onChange={(event) => onBotTokenChange(event.target.value)}
          placeholder={botTokenPlaceholder}
        />
      </LabeledField>

      {showAllowedGuildIds !== false ? (
      <LabeledField label="Allowed server IDs">
        <Textarea
          value={allowedGuildIds}
          onChange={(event) => onAllowedGuildIdsChange(event.target.value)}
          rows={3}
          placeholder="123456789012345678"
        />
      </LabeledField>
      ) : null}

      {showAllowedChannelIds !== false ? (
      <LabeledField label="Allowed channel IDs">
        <Textarea
          value={allowedChannelIds}
          onChange={(event) => onAllowedChannelIdsChange(event.target.value)}
          rows={3}
          placeholder="123456789012345678"
        />
      </LabeledField>
      ) : null}

      {showReplyInThread !== false ? (
      <ChannelBehaviorToggle
        title="Reply in thread"
        description="Send Discord replies as message replies."
        ariaLabel="Reply in Discord thread"
        checked={replyInThread}
        onCheckedChange={onReplyInThreadChange}
      />
      ) : null}
    </IntegrationSettingsCard>
  );
}

export function SetupSlackGuidePanel({
  slackBotToken,
  slackAppToken,
}: {
  slackBotToken: string;
  slackAppToken: string;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-background/70 p-4">
      <div>
        <p className="font-medium">Slack onboarding wizard</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure native Slack Socket Mode now, then run setup check from helper settings after launch.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Required tokens: bot token (`xoxb-...`) and app token (`xapp-...`).
        </p>
      </div>
      <div className="rounded-2xl border border-border/70 bg-background/70 p-3 text-sm">
        <p className="font-medium">Recommended scopes</p>
        <p className="mt-1 text-muted-foreground">
          Bot scopes: {SLACK_SETUP_BOT_SCOPES.join(", ")}
        </p>
        <p className="mt-1 text-muted-foreground">
          App scopes: {SLACK_SETUP_APP_SCOPES.join(", ")}
        </p>
      </div>
      <details className="rounded-2xl border border-border/70 bg-background/70 p-3">
        <summary className="cursor-pointer text-sm font-medium">Setup checklist</summary>
        <div className="mt-3 space-y-2 text-sm">
          <div className="rounded-xl border border-border/60 px-3 py-2">
            <p className="font-medium">Done · Turn on Slack</p>
          </div>
          <div className="rounded-xl border border-border/60 px-3 py-2">
            <p className="font-medium">
              {slackBotToken.trim() ? "Done" : "Pending"} · Save Slack bot token
            </p>
          </div>
          <div className="rounded-xl border border-border/60 px-3 py-2">
            <p className="font-medium">
              {slackAppToken.trim() ? "Done" : "Pending"} · Save Slack app token
            </p>
          </div>
          <div className="rounded-xl border border-border/60 px-3 py-2">
            <p className="font-medium">Pending · Enable Slack Socket Mode in app settings</p>
          </div>
          <div className="rounded-xl border border-border/60 px-3 py-2">
            <p className="font-medium">Pending · Launch helper and run setup check in settings</p>
          </div>
        </div>
      </details>
      <Button type="button" variant="outline" disabled>
        Run setup check after launch
      </Button>
    </div>
  );
}

function ChannelBehaviorToggle({
  title,
  description,
  ariaLabel,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  ariaLabel: string;
  checked: boolean;
  onCheckedChange?: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/70 px-4 py-4">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        aria-label={ariaLabel}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
