export type ProviderMessage = { role: "user" | "assistant" | "system"; content: string };
export interface Provider { stream(messages: ProviderMessage[], model: string): Promise<ReadableStream<Uint8Array>>; }
