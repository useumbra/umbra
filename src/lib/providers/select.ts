import { models, type ModelConfig } from "../../config/models";
import { OpenRouterProvider } from "./openrouter";
import { StubProvider } from "./stub";
import { VeniceProvider } from "./venice";
import type { Provider } from "./types";

export type ProviderEnvironment = {
  [key: string]: string | undefined;
  OPENROUTER_API_KEY?: string;
  VENICE_API_KEY?: string;
};

const hasKey = (value: string | undefined) => Boolean(value?.trim());

const providerName = (model: ModelConfig): "openrouter" | "venice" =>
  model.provider ?? "openrouter";

export const availableModels = (
  catalog: ModelConfig[] = models,
  environment: ProviderEnvironment = process.env,
) => {
  const available = catalog.filter((model) => {
    if (model.id === "umbra-auto") return true;
    return providerName(model) === "venice"
      ? hasKey(environment.VENICE_API_KEY)
      : hasKey(environment.OPENROUTER_API_KEY);
  });
  const auto = catalog.find((model) => model.id === "umbra-auto");
  return auto && !available.includes(auto) ? [auto, ...available] : available;
};

export const providerFor = (
  modelId: string,
  catalog: ModelConfig[] = models,
  environment: ProviderEnvironment = process.env,
): Provider => {
  const model = catalog.find((item) => item.id === modelId);
  if (
    model &&
    providerName(model) === "venice" &&
    hasKey(environment.VENICE_API_KEY)
  )
    return new VeniceProvider(catalog);
  if (hasKey(environment.OPENROUTER_API_KEY)) return new OpenRouterProvider();
  return new StubProvider();
};
