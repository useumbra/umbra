import { NextRequest } from "next/server";
import { FalProvider, StubImageProvider } from "@/lib/providers/image";
export const runtime = "nodejs";

export function GET() {
  return Response.json({ stub: !process.env.FAL_KEY });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    prompt?: string;
    aspectRatio?: "square" | "landscape" | "portrait";
    steps?: number;
  };
  if (!body.prompt)
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  const provider = process.env.FAL_KEY
    ? new FalProvider()
    : new StubImageProvider();
  try {
    return Response.json(
      await provider.generate({
        prompt: body.prompt,
        aspectRatio: body.aspectRatio,
        steps: body.steps,
      }),
    );
  } catch {
    return Response.json(
      { error: "Image generation unavailable" },
      { status: 502 },
    );
  }
}
