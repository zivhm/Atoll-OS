import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HelperAvatar } from "@/components/HelperAvatar";
import type { AgentAvatar } from "@/lib/api";

export function AgentAvatarField({
  avatar,
  helperName,
  onRandomize,
  onRemove,
}: {
  avatar?: AgentAvatar;
  helperName: string;
  onRandomize: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-background/60 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <HelperAvatar
            avatar={avatar}
            helperName={helperName}
            className="h-20 w-20 border border-border/70 shadow-sm"
            fallbackClassName="text-xl"
            imageSize={128}
            alt="Helper avatar preview"
            testId="helper-avatar-preview"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={onRandomize}>
            <RefreshCw className="h-4 w-4" />
            Randomize
          </Button>
          <Button type="button" variant="outline" onClick={onRemove}>
            Remove image
          </Button>
        </div>
      </div>
    </div>
  );
}
