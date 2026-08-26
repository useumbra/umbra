import type { ModelConfig } from "../config/models";

export type RouteDecision = {
  model: string;
  reason: string;
};

const findModel = (
  models: ModelConfig[],
  predicate: (model: ModelConfig) => boolean,
  fallback: ModelConfig,
) => models.find(predicate) ?? fallback;

export const route = (prompt: string, models: ModelConfig[]): RouteDecision => {
  const available = models.filter((model) => model.id !== "umbra-auto");
  const fallback =
    available.find((model) => model.id === "nova-4") ??
    available[0] ??
    models[0];
  const estimatedTokens = Math.ceil(prompt.length / 4);

  if (
    /```|<\/?[a-z][^>]*>|(?:^|\s)(?:typescript|javascript|python|rust|sql|css|html|bash)\b/i.test(
      prompt,
    )
  ) {
    const model = findModel(
      available,
      (candidate) => candidate.id === "qwen-coder",
      fallback,
    );
    return {
      model: model.id,
      reason: "code syntax or a programming language signal",
    };
  }

  if (
    estimatedTokens > 1500 &&
    /\b(?:explain|summari[sz]e|summarise|outline|digest|review)\b/i.test(prompt)
  ) {
    const model = findModel(
      available,
      (candidate) => candidate.id === "gemini-flash",
      fallback,
    );
    return {
      model: model.id,
      reason: "long explanatory prompt benefits from a large context window",
    };
  }

  if (
    /\b(?:prove|equation|calculate|derivative|integral|logic|reasoning|solve|why)\b/i.test(
      prompt,
    )
  ) {
    const model = findModel(
      available,
      (candidate) => candidate.id === "reasoning-r1",
      fallback,
    );
    return {
      model: model.id,
      reason: "math or deliberate reasoning signal",
    };
  }

  if (estimatedTokens > fallback.contextWindow) {
    const model =
      [...available].sort((a, b) => b.contextWindow - a.contextWindow)[0] ??
      fallback;
    return {
      model: model.id,
      reason: "prompt length requires the largest available context window",
    };
  }

  return {
    model: fallback.id,
    reason: "general prompt routed to the everyday model",
  };
};
