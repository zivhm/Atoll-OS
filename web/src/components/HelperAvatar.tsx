import * as React from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { AgentAvatar } from "@/lib/api";
import { buildAgentAvatarUrl, getHelperInitials } from "@/lib/agent-avatar";
import { cn } from "@/lib/utils";

export function HelperAvatar({
  avatar,
  helperName,
  className,
  fallbackClassName,
  imageSize = 96,
  alt,
  testId,
}: {
  avatar?: AgentAvatar;
  helperName: string;
  className?: string;
  fallbackClassName?: string;
  imageSize?: number;
  alt?: string;
  testId?: string;
}) {
  const normalizedName = helperName.trim() || "Helper";
  const avatarUrl = avatar ? buildAgentAvatarUrl(avatar, imageSize) : undefined;
  const [showImage, setShowImage] = React.useState(Boolean(avatarUrl));

  React.useEffect(() => {
    setShowImage(Boolean(avatarUrl));
  }, [avatarUrl]);

  return (
    <Avatar
      className={cn(
        "border border-border/70 bg-muted text-muted-foreground shadow-sm",
        className,
      )}
      data-testid={testId}
    >
      {avatarUrl && showImage ? (
        <img
          src={avatarUrl}
          alt={alt ?? `${normalizedName} avatar`}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setShowImage(false)}
        />
      ) : null}
      <AvatarFallback
        className={cn(
          "bg-transparent font-semibold uppercase",
          showImage ? "hidden" : undefined,
          fallbackClassName,
        )}
      >
        {getHelperInitials(normalizedName)}
      </AvatarFallback>
    </Avatar>
  );
}
