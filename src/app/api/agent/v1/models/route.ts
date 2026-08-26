import { models } from "@/config/models";
import { requireApiAuth } from "@/lib/api-auth";

export const runtime = "nodejs";

export function GET(request: Request) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;
  return Response.json({
    object: "list",
    data: models.map((model) => ({
      id: model.id,
      object: "model",
      created: 1_741_000_000,
      owned_by: "umbra",
      credit_pricing: model.creditPricing,
      capabilities: model.capabilities,
      context_window: model.contextWindow,
    })),
  });
}
