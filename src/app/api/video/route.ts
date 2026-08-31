import { NextRequest } from "next/server";
import { FalVideoProvider, StubVideoProvider } from "@/lib/providers/video";
import { UpstreamError } from "@/lib/providers/upstream";
export const runtime = "nodejs";
const stubProvider = new StubVideoProvider();

export async function GET(request: NextRequest) {
  const requestId = request.nextUrl.searchParams.get("requestId");
  if (requestId) {
    const provider = process.env.FAL_KEY
      ? new FalVideoProvider()
      : stubProvider;
    try {
      return Response.json(await provider.status(requestId));
    } catch (error) {
      return Response.json(
        {
          error: "Video generation unavailable",
          ...(error instanceof UpstreamError ? { upstream: error.status } : {}),
        },
        { status: 502 },
      );
    }
  }
  return Response.json({ stub: !process.env.FAL_KEY });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    prompt?: string;
    aspectRatio?: "square" | "landscape" | "portrait";
  };
  if (!body.prompt)
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  const provider = process.env.FAL_KEY ? new FalVideoProvider() : stubProvider;
  try {
    const submitted = await provider.submit({
      prompt: body.prompt,
      aspectRatio: body.aspectRatio,
    });
    return Response.json({
      requestId: submitted.requestId,
      model: submitted.model,
      stub: !process.env.FAL_KEY,
      ...(submitted.url ? { url: submitted.url } : {}),
    });
  } catch (error) {
    return Response.json(
      {
        error: "Video generation unavailable",
        ...(error instanceof UpstreamError ? { upstream: error.status } : {}),
      },
      { status: 502 },
    );
  }
}
