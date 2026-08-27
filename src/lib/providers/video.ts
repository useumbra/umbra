import { deterministicSvg, mediaUrl, type ImageRequest } from "./media";

const model = "fal-ai/wan/v2.7/text-to-video";

export type VideoStatus = {
  state: "queued" | "running" | "done" | "failed";
  url?: string;
};

export const mapFalVideoStatus = (status: unknown): VideoStatus["state"] =>
  status === "IN_QUEUE"
    ? "queued"
    : status === "IN_PROGRESS"
      ? "running"
      : status === "COMPLETED"
        ? "done"
        : "failed";

type VideoProvider = {
  submit(request: ImageRequest): Promise<{
    requestId: string;
    model: string;
    url?: string;
  }>;
  status(requestId: string): Promise<VideoStatus>;
};

type VideoSubmission = {
  requestId: string;
  model: string;
  url?: string;
};

export class FalVideoProvider implements VideoProvider {
  async submit(request: ImageRequest): Promise<VideoSubmission> {
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
    return { requestId: queued.request_id, model };
  }

  async status(requestId: string): Promise<VideoStatus> {
    const statusResponse = await fetch(
      `https://queue.fal.run/fal-ai/wan/requests/${encodeURIComponent(requestId)}/status`,
      { headers: { Authorization: `Key ${process.env.FAL_KEY}` } },
    );
    if (!statusResponse.ok) throw new Error("Video status unavailable");
    const status = (await statusResponse.json()) as { status?: string };
    const state = mapFalVideoStatus(status.status);
    if (state !== "done") return { state };
    const resultResponse = await fetch(
      `https://queue.fal.run/fal-ai/wan/requests/${encodeURIComponent(requestId)}`,
      { headers: { Authorization: `Key ${process.env.FAL_KEY}` } },
    );
    if (!resultResponse.ok) throw new Error("Video result unavailable");
    const url = mediaUrl(await resultResponse.json(), "video");
    if (!url) throw new Error("Video provider returned no video");
    return { state, url };
  }
}

export class StubVideoProvider implements VideoProvider {
  private readonly results = new Map<string, string>();

  async submit(request: ImageRequest): Promise<VideoSubmission> {
    const requestId = `stub-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const url = deterministicSvg(request.prompt, "video");
    this.results.set(requestId, url);
    return { requestId, model: "umbra-video-stub", url };
  }

  async status(requestId: string): Promise<VideoStatus> {
    const url = this.results.get(requestId);
    if (!url) return { state: "failed" };
    return { state: "done", url };
  }
}
