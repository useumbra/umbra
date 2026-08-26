import {
  deterministicSvg,
  falAspect,
  mediaUrl,
  type ImageRequest,
  type MediaProvider,
  type MediaResult,
} from "./media";

const model = "fal-ai/flux/schnell";

export class FalProvider implements MediaProvider {
  async generate(request: ImageRequest): Promise<MediaResult> {
    const submit = await fetch(`https://queue.fal.run/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: request.prompt,
        image_size: falAspect(request.aspectRatio),
        num_inference_steps: Math.min(4, Math.max(1, request.steps ?? 4)),
      }),
    });
    if (!submit.ok) throw new Error("Image provider unavailable");
    const queued = (await submit.json()) as {
      request_id?: string;
      status_url?: string;
      response_url?: string;
    };
    if (!queued.request_id || !queued.status_url || !queued.response_url)
      throw new Error("Image provider returned an invalid queue response");
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const statusResponse = await fetch(queued.status_url, {
        headers: { Authorization: `Key ${process.env.FAL_KEY}` },
      });
      const status = (await statusResponse.json()) as { status?: string };
      if (status.status === "COMPLETED") break;
      if (status.status !== "IN_QUEUE" && status.status !== "IN_PROGRESS")
        throw new Error("Image generation failed");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const resultResponse = await fetch(queued.response_url, {
      headers: { Authorization: `Key ${process.env.FAL_KEY}` },
    });
    if (!resultResponse.ok) throw new Error("Image result unavailable");
    const url = mediaUrl(await resultResponse.json(), "image");
    if (!url) throw new Error("Image provider returned no image");
    return { url, stub: false, model };
  }
}

export class StubImageProvider implements MediaProvider {
  async generate(request: ImageRequest): Promise<MediaResult> {
    return {
      url: deterministicSvg(request.prompt, "image"),
      stub: true,
      model: "umbra-image-stub",
    };
  }
}
