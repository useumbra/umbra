import { models } from "../../config/models";
import { deductCredits, type CreditVaultData } from "./crypto";

export const estimateModelCost = (
  modelId: string,
  inputTokens: number,
  outputTokens: number,
) => {
  const model = models.find((candidate) => candidate.id === modelId);
  if (!model) throw new Error("Unknown model");
  return (
    (Math.max(0, inputTokens) * model.creditPricing.inPer1M +
      Math.max(0, outputTokens) * model.creditPricing.outPer1M) /
    1_000_000
  );
};

export const deductModelRequest = (
  vault: CreditVaultData,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
) =>
  deductCredits(
    vault,
    estimateModelCost(modelId, inputTokens, outputTokens),
    `${modelId} request`,
  );
