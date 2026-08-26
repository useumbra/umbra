import { NextRequest } from "next/server";
import { FalVideoProvider, StubVideoProvider } from "@/lib/providers/video";
export const runtime = "nodejs";

export function GET() {
  return Response.json({ stub: !process.env.FAL_KEY });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { prompt?: string };
  if (!body.prompt)
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  const provider = process.env.FAL_KEY
    ? new FalVideoProvider()
    : new StubVideoProvider();
  try {
    return Response.json(await provider.generate({ prompt: body.prompt }));
  } catch {
    return Response.json(
      { error: "Video generation unavailable" },
      { status: 502 },
    );
  }
}
