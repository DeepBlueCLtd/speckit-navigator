# spec-navigator

Browser-based viewer for [speckit](https://github.com/github/spec-kit) specifications. Renders any GitHub repository's `specs/NNN-name/` artefacts (`spec.md`, `plan.md`, `tasks.md`, `evidence/`, `contracts/`, …) with markdown rendering, inline review comments, and one-click feedback submission as a PR comment.

This repository was extracted from [`debrief/debrief-future`](https://github.com/debrief/debrief-future) — see that repo's spec at `specs/248-extract-spec-navigator/` for the rationale.

**Hosted instance**: <https://debrief.github.io/spec-navigator/>

## Quick start (consumers)

You don't need to install anything to *use* spec-navigator. Open the hosted instance with a query string pointing at the repo and branch you want to view.

```
# View the default debrief-future spec list (no parameters required)
https://debrief.github.io/spec-navigator/

# View any GitHub repo by ?repo= and ?branch=
https://debrief.github.io/spec-navigator/?repo=octocat/hello-world&branch=main

# Legacy form — debrief-future PR shortcut (equivalent to ?repo=debrief/debrief-future&branch=<pr-branch>)
https://debrief.github.io/spec-navigator/?pr=123
```

See [CONFIGURATION.md](./CONFIGURATION.md) for the full URL contract and the build-time env vars.

## Quick start (contributors)

```sh
git clone https://github.com/debrief/spec-navigator.git
cd spec-navigator
pnpm install
pnpm dev          # local dev server
pnpm test         # vitest, no GitHub network
pnpm test:e2e     # Playwright with bundled fixtures (default)
pnpm lint
pnpm typecheck
```

You do **not** need a GitHub token to produce a green local build. The Playwright tests run against bundled HTTP fixtures by default.

To run E2E tests against the live GitHub API (used by the nightly `live.yml` CI workflow):

```sh
LIVE_GITHUB=1 GITHUB_TOKEN=<your-PAT> pnpm test:e2e:live
```

## Configuration

Three things are configurable: the default repo, vendor branding, and the Vite base path. All three have sensible defaults baked in for the hosted instance, so most adopters won't need to change them.

| What | How | Default |
|---|---|---|
| Default repo (when no `?repo=` in URL) | `VITE_DEFAULT_OWNER`, `VITE_DEFAULT_REPO` (build-time env vars) | `debrief/debrief-future` |
| Vite base path | `VITE_BASE` (build-time env var) | `/spec-navigator/` |
| Per-request consumer | `?repo=<org>/<name>` + `?branch=<branch>` (URL params) | falls back to env defaults |

See [CONFIGURATION.md](./CONFIGURATION.md) for full details.

## Self-hosting

The hosted instance at `https://debrief.github.io/spec-navigator/` is sufficient for most consumers — you select your repo via URL parameters at view time. Self-hosting is only needed if you want to:

- bake a different default repo into the build, or
- host under a different path or domain, or
- host a private fork with a custom branding.

To self-host:

1. Fork this repository.
2. Set `VITE_DEFAULT_OWNER`, `VITE_DEFAULT_REPO`, and `VITE_BASE` in your fork's Pages deploy environment (or `VITE_BASE` repo variable).
3. If your repo is private, register a `GITHUB_TOKEN` Actions secret with `metadata:read` and `contents:read` on the target repo (and `repo` if private).
4. Update `live.yml` to point its smoke-test target at your repo (the default targets `debrief/debrief-future`).

Three steps. No further changes needed — the same URL contract works for any consumer.

## Architecture (one-paragraph summary)

A static React + Vite SPA. No backend. Reads from the GitHub REST + raw-content APIs at request time, validated through Zod at the boundary. Optionally posts comments to PRs via the user's PAT (stored in `localStorage`, never URL-bound). E2E tests run against HTTP fixtures by default; live mode hits real GitHub.

For deep dives, see the spec at the source repository: <https://github.com/debrief/debrief-future/tree/main/specs/248-extract-spec-navigator>.

## Licensing

Same licence as the source repository (`debrief/debrief-future`). See `LICENSE`.

## Security

PATs live in `localStorage` only — never in URLs, never in logs. See [SECURITY.md](./SECURITY.md) for token-rotation policy and reporting procedures.
