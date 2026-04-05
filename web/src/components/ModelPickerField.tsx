import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface ModelPickerItem {
  id: string;
  name: string;
  promptPricePer1M?: number | null;
  completionPricePer1M?: number | null;
}

export function ModelPickerField({
  value,
  fallbackLabel = "Choose a model",
  items,
  onChange,
  statusText,
}: {
  value: string;
  fallbackLabel?: string;
  items: ModelPickerItem[];
  onChange: (value: string) => void;
  statusText?: string;
}) {
  const [open, setOpen] = useState(false);
  const buttonLabel = value || fallbackLabel;

  return (
    <div>
      <Popover modal={false} open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-12 w-full justify-between rounded-2xl border-border/70 bg-background/70 font-normal"
          >
            <span className="truncate">{buttonLabel}</span>
            <ChevronsUpDown className="h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[min(32rem,90vw)] p-0"
          align="start"
          onWheelCapture={(event) => event.stopPropagation()}
        >
          <Command>
            <CommandInput placeholder="Search models..." />
            <CommandList className="max-h-[18rem] overscroll-contain">
              <CommandEmpty>No model found.</CommandEmpty>
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.id} ${item.name}`}
                    onSelect={() => {
                      onChange(item.id);
                      setOpen(false);
                    }}
                  >
                    <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.id}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          Prompt {formatPrice(item.promptPricePer1M)} · Completion{" "}
                          {formatPrice(item.completionPricePer1M)}
                        </p>
                      </div>
                      {value === item.id ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0" />
                      ) : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {statusText ? (
        <p className="mt-2 text-xs text-muted-foreground">{statusText}</p>
      ) : null}
    </div>
  );
}

function formatPrice(value: number | null | undefined): string {
  if (value == null) {
    return "n/a";
  }

  return `$${value.toFixed(2)}/1M`;
}
