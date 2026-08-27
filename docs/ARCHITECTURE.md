# Architecture

## Request path

The browser creates a conversation vault and runs Smart Privacy before a normal chat request. It sends the protected message to `/api/chat`, which selects a model when `umbra-auto` is requested and streams the request through the OpenRouter adapter. The browser restores placeholders in the streamed assistant response. Web search is an opt-in OpenRouter plugin; citations are collected from the stream and stored on the assistant message.

The OpenAI-compatible endpoint lives under `/api/agent/v1`. It authenticates with the configured server secret and expects client applications to perform their own redaction before sending requests.

## Provider adapters

Provider interfaces and message types live in `src/lib/providers/types.ts`. The adapters are:

- `src/lib/providers/openrouter.ts` — streaming OpenRouter chat and optional web search.
- `src/lib/providers/stub.ts` — deterministic chat and code responses without provider credentials.
- `src/lib/providers/image.ts` — synchronous fal.ai image generation and its deterministic stub.
- `src/lib/providers/video.ts` — fal.ai queue-backed video generation and its deterministic stub.
- `src/lib/providers/media.ts` — shared image/video request and result helpers.

The API routes in `src/app/api/` choose the live adapter when its environment variable is present and otherwise choose the corresponding stub.

## Video queue flow

`POST /api/video` submits a prompt to the fal.ai queue and returns a request ID. `GET /api/video?requestId=...` checks the queue status. `IN_QUEUE` and `IN_PROGRESS` become queued and running states; a completed request fetches its result and returns the video URL. The browser polls every three seconds for up to six minutes and aborts the request on unmount. Stub POST responses include their deterministic data URL directly, so they do not depend on server-side request state.

## Browser storage

The browser-local data stores are:

- IndexedDB database `umbra-local`, object stores `conversations` and `settings`. Conversation records contain messages and each conversation's serialized vault. Settings include `mode`, `model`, `effort`, `webSearch`, `toolUse`, `memory`, and `connectors`.
- IndexedDB database `umbra-media`, object store `history`, for image and video history.
- IndexedDB database `umbra-credits`, object store `vault`, with the encrypted vault under key `local`.
- `localStorage` key `umbra-theme`, for the light/dark theme preference.

The credits vault uses WebCrypto PBKDF2 and AES-GCM. Connector headers are stored with the browser-local connector registry. The MCP route is a stateless HTTPS-only proxy for initialize, tools/list, and tools/call.

## Cloudflare and OpenNext

The app is a Next.js App Router project. OpenNext produces the Worker entrypoint at `.open-next/worker.js` and the static asset directory at `.open-next/assets`, as configured in `wrangler.jsonc`. API routes that call Node-oriented libraries declare the Node.js runtime where needed. Cloudflare deployment uses an OpenNext build followed by `wrangler versions upload` and an explicit `wrangler versions deploy <version-id>@100%`; this promotion step is used to ensure the generated asset version is active.
