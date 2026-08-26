export type ProviderContent =
  | string
  | (
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    )[];
export type ProviderMessage = {
  role: "user" | "assistant" | "system";
  content: ProviderContent;
};
export type ReasoningEffort =
  "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
export type ProviderOptions = {
  reasoningEffort?: ReasoningEffort;
  maxTokens?: number;
};
export interface Provider {
  stream(
    messages: ProviderMessage[],
    model: string,
    options?: ProviderOptions,
  ): Promise<ReadableStream<Uint8Array>>;
}
