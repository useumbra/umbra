import {
  deterministicSvg,
  mediaUrl,
  type ImageRequest,
  type MediaProvider,
  type MediaResult,
} from "./media";

const model = "fal-ai/wan/v2.7/text-to-video";

export class FalVideoProvider implements MediaProvider {
  async generate(request: ImageRequest): Promise<MediaResult> {
    const submit = await fetch(`https://queue.fal.run/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: request.prompt,
        aspect_ratio:
          request.aspectRatio === "portrait"
            ? "9:16"
            : request.aspectRatio === "square"
              ? "1:1"
              : "16:9",
      }),
    });
    if (!submit.ok) throw new Error("Video provider unavailable");
    const queued = (await submit.json()) as {
      request_id?: string;
      status_url?: string;
      response_url?: string;
    };
    if (!queued.request_id || !queued.status_url || !queued.response_url)
      throw new Error("Video provider returned an invalid queue response");
    for (let attempt = 0; attempt < 240; attempt += 1) {
      const statusResponse = await fetch(queued.status_url, {
        headers: { Authorization: `Key ${process.env.FAL_KEY}` },
      });
      const status = (await statusResponse.json()) as { status?: string };
      if (status.status === "COMPLETED") break;
      if (status.status !== "IN_QUEUE" && status.status !== "IN_PROGRESS")
        throw new Error("Video generation failed");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const resultResponse = await fetch(queued.response_url, {
      headers: { Authorization: `Key ${process.env.FAL_KEY}` },
    });
    if (!resultResponse.ok) throw new Error("Video result unavailable");
    const url = mediaUrl(await resultResponse.json(), "video");
    if (!url) throw new Error("Video provider returned no video");
    return { url, stub: false, model };
  }
}

export class StubVideoProvider implements MediaProvider {
  async generate(request: ImageRequest): Promise<MediaResult> {
    return {
      url: deterministicSvg(request.prompt, "video"),
      stub: true,
      model: "umbra-video-stub",
    };
  }
}
