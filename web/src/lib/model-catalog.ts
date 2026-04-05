export type FallbackModelItem = {
  id: string;
  name: string;
  promptPricePer1M?: number;
  completionPricePer1M?: number;
};

export const DEFAULT_LLM_PROVIDER = "openrouter";

export const FALLBACK_MODEL_ITEMS: FallbackModelItem[] = [
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4" },
  { id: "openai/gpt-5.3-chat", name: "GPT-5.3 Chat" },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct" },
];

export function buildSecretQueryFingerprint(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "server-default";
  }

  // Stable non-reversible cache bucket marker; prevents raw secret leakage in query keys.
  let hash = 2166136261;
  for (let index = 0; index < trimmed.length; index += 1) {
    hash ^= trimmed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `custom-${(hash >>> 0).toString(16)}`;
}
