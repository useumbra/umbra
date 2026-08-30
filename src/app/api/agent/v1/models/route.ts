import { requireApiAuth } from "@/lib/api-auth";
import { availableModels } from "@/lib/providers/select";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = await requireApiAuth(request);
  if (unauthorized) return unauthorized;
  return Response.json({
    object: "list",
    data: availableModels().map((model) => ({
      id: model.id,
      object: "model",
      created: 1_741_000_000,
      owned_by: "umbra",
      credit_pricing: model.creditPricing,
      capabilities: model.capabilities,
      context_window: model.contextWindow,
      provider: model.provider ?? "openrouter",
    })),
  });
}
