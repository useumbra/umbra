export type ModelConfig = {
  id: string;
  label: string;
  description: string;
  contextWindow: number;
  upstreamSlug: string;
  creditPricing: { inPer1M: number; outPer1M: number };
  capabilities: {
    streaming: boolean;
    vision: boolean;
    files: boolean;
    tools: boolean;
    webSearch: boolean;
    reasoning: boolean;
  };
};

export const models: ModelConfig[] = [
  { id: "umbra-auto", label: "Umbra Auto", description: "A balanced route selected for your prompt", contextWindow: 128000, upstreamSlug: "openai/gpt-4o-mini", creditPricing: { inPer1M: 0.15, outPer1M: 0.6 }, capabilities: { streaming: true, vision: true, files: true, tools: true, webSearch: true, reasoning: false } },
  { id: "nova-4", label: "Nova 4", description: "Fast, capable everyday reasoning", contextWindow: 128000, upstreamSlug: "openai/gpt-4o", creditPricing: { inPer1M: 2.5, outPer1M: 10 }, capabilities: { streaming: true, vision: true, files: true, tools: true, webSearch: false, reasoning: false } },
  { id: "sage-sonnet", label: "Sage Sonnet", description: "Careful writing and analysis", contextWindow: 200000, upstreamSlug: "anthropic/claude-sonnet-4.5", creditPricing: { inPer1M: 3, outPer1M: 15 }, capabilities: { streaming: true, vision: true, files: true, tools: true, webSearch: false, reasoning: false } },
  { id: "reasoning-r1", label: "Reasoning R1", description: "Deep, deliberate problem solving", contextWindow: 65536, upstreamSlug: "deepseek/deepseek-r1", creditPricing: { inPer1M: 0.55, outPer1M: 2.19 }, capabilities: { streaming: true, vision: false, files: false, tools: false, webSearch: false, reasoning: true } },
  { id: "gemini-flash", label: "Gemini Flash", description: "Multimodal speed with a large context", contextWindow: 1000000, upstreamSlug: "google/gemini-2.5-flash", creditPricing: { inPer1M: 0.1, outPer1M: 0.4 }, capabilities: { streaming: true, vision: true, files: true, tools: true, webSearch: true, reasoning: false } },
  { id: "qwen-coder", label: "Qwen Coder", description: "Focused help for code and debugging", contextWindow: 131072, upstreamSlug: "qwen/qwen-2.5-coder-32b-instruct", creditPricing: { inPer1M: 0.18, outPer1M: 0.18 }, capabilities: { streaming: true, vision: false, files: true, tools: true, webSearch: false, reasoning: false } },
  { id: "llama-open", label: "Llama Open", description: "Open-weight conversation", contextWindow: 131072, upstreamSlug: "meta-llama/llama-3.3-70b-instruct", creditPricing: { inPer1M: 0.4, outPer1M: 0.4 }, capabilities: { streaming: true, vision: false, files: false, tools: true, webSearch: false, reasoning: false } },
  { id: "mistral-small", label: "Mistral Small", description: "Efficient and precise", contextWindow: 32000, upstreamSlug: "mistralai/mistral-small-3.1-24b-instruct", creditPricing: { inPer1M: 0.1, outPer1M: 0.3 }, capabilities: { streaming: true, vision: true, files: false, tools: true, webSearch: false, reasoning: false } },
];
