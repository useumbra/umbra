# Security policy

## Supported versions

Umbra is pre-1.0. Security fixes are supported on the latest `0.1.x` source on the default branch.

## Reporting a vulnerability

Report vulnerabilities through a GitHub private security advisory for [useumbra/umbra](https://github.com/useumbra/umbra/security/advisories/new). Do not open a public issue for a vulnerability or include secrets or personal data in a report.

Include a concise description, affected route or component, reproduction steps that use synthetic data, and an assessment of the impact. Allow time for triage and remediation before public disclosure.

## In scope

- A redaction bypass that exposes protected values to a provider.
- Leakage of API keys, connector credentials, or other secrets to providers, logs, or clients.
- A sandbox escape from the `/code` live-preview iframe.
- Incorrect handling of browser-local vault or conversation data that exposes original values.

## Out of scope

- Provider-side model behavior or provider data handling outside Umbra.
- Denial-of-service attacks against the free tier.
- Issues that require a user to intentionally disclose their own secret data.
