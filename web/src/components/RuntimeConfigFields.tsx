import type { RuntimeConfigFieldDescriptor } from "@/lib/api";
import type { RuntimeConfigFormState } from "@/lib/runtime-config";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export function RuntimeConfigFields({
  fields,
  values,
  onChange,
  secretPlaceholder,
}: {
  fields: RuntimeConfigFieldDescriptor[];
  values: RuntimeConfigFormState;
  onChange: (key: string, value: string | boolean) => void;
  secretPlaceholder?: string;
}) {
  return (
    <div className="space-y-4">
      {fields.map((field) => {
        if (field.kind === "boolean") {
          return (
            <div
              key={field.key}
              className="flex items-center justify-between rounded-3xl border border-border/70 bg-background/60 px-4 py-4"
            >
              <div className="pr-4">
                <p className="font-medium">{field.label}</p>
                {field.helperText ? (
                  <p className="text-sm text-muted-foreground">{field.helperText}</p>
                ) : null}
              </div>
              <Switch
                checked={Boolean(values[field.key])}
                onCheckedChange={(checked) => onChange(field.key, checked)}
              />
            </div>
          );
        }

        const rawValue = values[field.key];
        const stringValue = typeof rawValue === "string" ? rawValue : "";
        const placeholder = field.secret ? secretPlaceholder || field.placeholder : field.placeholder;

        return (
          <div key={field.key}>
            <Label className="mb-2 block text-sm font-medium">{field.label}</Label>
            {field.kind === "json" ? (
              <Textarea
                value={stringValue}
                onChange={(event) => onChange(field.key, event.target.value)}
                rows={5}
                placeholder={placeholder}
              />
            ) : (
              <Input
                type={field.secret ? "password" : field.kind === "number" ? "number" : "text"}
                value={stringValue}
                onChange={(event) => onChange(field.key, event.target.value)}
                placeholder={placeholder}
              />
            )}
            {field.helperText ? (
              <p className="mt-2 text-xs text-muted-foreground">{field.helperText}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
