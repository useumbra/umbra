export type ProviderMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};
export type ReasoningEffort =
  "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
export type ProviderOptions = {
  reasoningEffort?: ReasoningEffort;
};
export interface Provider {
  stream(
    messages: ProviderMessage[],
    model: string,
    options?: ProviderOptions,
  ): Promise<ReadableStream<Uint8Array>>;
}
