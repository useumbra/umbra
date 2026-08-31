# Changelog

All notable changes to Umbra are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Venice as a second chat provider with three catalog models, streaming, Venice web search with citations, and a provider label in the model catalog.
- A Venice-backed MCP endpoint at `/api/mcp/venice` with `venice_web_answer`, `venice_characters_search`, and `venice_models`, plus a built-in connector card for it.
- The live $UMBRA contract address on Robinhood Chain is now shown on the site.
- Planned $UMBRA holder benefits are now surfaced on the site and roadmap.
- A live $UMBRA tier check now reads wallet balances without activating perks.
- Signed $UMBRA holder proofs now set enforced per-tier API quotas.
- Verified holder tiers now raise Council, chat, and UmbraCode capacity limits.
- Browser-local memory suggestions and voice dictation/read-aloud controls are now available.

### Changed

- Chat requests now route and retry according to the $UMBRA tier.
- On-chain reads fail over to a second public Robinhood Chain RPC.
- Venice models are hidden without `VENICE_API_KEY` and never fall back to another provider.
- Reasoning-capable Venice models default to `reasoning_effort: none` so answers are not returned empty.
- Connector URLs must use HTTPS in production; localhost HTTP is accepted only outside production.

## [0.1.0] - 2026-08-27

### Added

- Browser-side Smart Privacy with 17 detectors, Smart/Full/Off modes, and reversible placeholders.
- Streaming OpenRouter chat with `umbra-auto` routing, optional web search, source citations, browser-local Umbra Memory, and browser-side attachment extraction and redaction.
- UmbraImage and asynchronous UmbraVideo generation through fal.ai, including deterministic no-credential stubs; video renders take about two minutes.
- UmbraCode with a sandboxed iframe preview.
- An OpenAI-compatible API endpoint and developer API key page.
- An encrypted browser-local credits vault with recovery-file import/export.
- Browser-local MCP connector discovery and manual invocation, plus an experimental three-round agentic tool loop.
- Read-only Robinhood Chain ETH and USDG balance reads.
- Conversation search, export, and import.
- `/leak-check`, `/docs`, and `/roadmap` surfaces.
