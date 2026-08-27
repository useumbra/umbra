# Contributing to Umbra

Thanks for taking the time to contribute. Keep changes focused and describe the user-visible or operational effect in the pull request.

## Local setup

Use Node 22 and install the locked dependencies:

```bash
npm install
npm run dev
```

Run the full verification set before opening a pull request:

```bash
npx tsc --noEmit
npm run lint
npm run format:check
npm run test
npm run build
```

The build and test commands must work without provider credentials. Do not add steps that require secrets to local or pull-request verification.

## Branches and commits

Branches use the following form:

```txt
devin/<timestamp>-<slug>
```

Use a short imperative commit subject with the conventional prefixes used in this repository, such as `feat:`, `fix:`, `chore:`, or `docs:`.

## Code style

- Keep imports at the top of the file.
- Do not use `any`; use a narrower type or `unknown` with validation.
- Run Prettier on touched TypeScript and TSX files.
- Prefer focused changes and existing project patterns.
- Do not add dependencies casually; explain a new dependency in the pull request.
- Keep browser-only data in browser storage and preserve the privacy boundary.
- Add tests for new pure logic and behavior where practical.

## Security

Never commit API keys, tokens, passwords, `.env` files, account credentials, or real personal data. Check staged files before committing. Report security issues using the process in [SECURITY.md](SECURITY.md), not a public issue.
