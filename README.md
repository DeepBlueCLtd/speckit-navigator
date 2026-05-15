# speckit-navigator

Browser-based viewer for [speckit](https://github.com/github/spec-kit) specifications. Renders any GitHub repository's `specs/NNN-name/` artefacts (`spec.md`, `plan.md`, `tasks.md`, `evidence/`, `contracts/`, …) with markdown rendering, inline review comments, and one-click feedback submission as a PR comment.

This repository was extracted from [`debrief/debrief-future`](https://github.com/debrief/debrief-future) — see that repo's spec at `specs/248-extract-spec-navigator/` for the rationale.

**Hosted instance**: <https://deepbluecltd.github.io/speckit-navigator/>

## Quick start (consumers)

You don't need to install anything to *use* speckit-navigator. Open the hosted instance with a query string pointing at the repo and branch you want to view.

```
# View the default debrief-future spec list (no parameters required)
https://deepbluecltd.github.io/speckit-navigator/

# View any GitHub repo by ?repo= and ?branch=
https://deepbluecltd.github.io/speckit-navigator/?repo=octocat/hello-world&branch=main

# Legacy form — debrief-future PR shortcut (equivalent to ?repo=debrief/debrief-future&branch=<pr-branch>)
https://deepbluecltd.github.io/speckit-navigator/?pr=123
```

See [CONFIGURATION.md](./CONFIGURATION.md) for the full URL contract and the build-time env vars.

## Quick start (contributors)

```sh
git clone https://github.com/DeepBlueCLtd/speckit-navigator.git
cd speckit-navigator
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

## Integrating speckit-navigator into your repo

Any GitHub repository can point speckit-navigator at its own specs without forking or hosting anything — the hosted instance accepts your repo as a URL parameter. Two small additions make the experience seamless:

1. A GitHub Action that posts a "review this spec" link on PRs that introduce a new spec folder.
2. A spec layout that follows the conventions the navigator expects.

### 1. Auto-comment workflow

Copy [`examples/workflows/speckit-spec-review.yml`](./examples/workflows/speckit-spec-review.yml) into your repo at `.github/workflows/speckit-spec-review.yml`. The workflow:

- runs on every PR open / push / reopen that touches `specs/**`,
- lists files via the PR API and detects folders matching `specs/NNN-<slug>/` with status `added`,
- posts (or updates) a single PR comment with a link of the form `https://deepbluecltd.github.io/speckit-navigator/?repo=<owner>/<repo>&branch=<head-ref>#/specs/NNN-<slug>`,
- deletes its own comment if a later push removes the new spec, so the thread never carries stale links.

It needs `pull-requests: write` and uses the default `GITHUB_TOKEN` — no PAT, no secrets. If you self-host the navigator (see below), set the `NAVIGATOR_URL` env var in the workflow to your instance.

The link drops the reviewer onto the head branch of the PR, so they see the spec exactly as proposed. Inline review comments they leave from the navigator post back to that PR as a single consolidated comment (this part requires the reviewer's own PAT — see [SECURITY.md](./SECURITY.md)).

### 2. Spec layout the navigator understands

The navigator looks for feature folders directly under `specs/` matching `^\d+-[A-Za-z0-9._-]+$` (e.g. `specs/237-active-storyboard-persistence/`). Inside each folder, it auto-discovers and renders these artefacts when present:

| File / folder | Role |
|---|---|
| `spec.md` | The spec itself. Required for the folder to count. |
| `plan.md`, `tasks.md`, `data-model.md`, `quickstart.md`, `research.md` | Rendered as sibling tabs. |
| `contracts/` | Any schema files (JSON / YAML / TS) shown as raw text. |
| `evidence/` | Linked artefacts (logs, screenshots, transcripts). |
| `checklists/` | `/speckit.*` checklists; rendered with checkbox state preserved. |
| `media/` | Images referenced from the markdown via relative paths. |

A few conventions keep the experience clean:

- **One feature per folder.** Don't nest `specs/NNN-foo/specs/MMM-bar/` — the navigator only scans one level deep.
- **Stable numeric prefix.** Use a monotonically increasing integer (issue number, RFC number, whatever your team uses). The number is how the navigator sorts and deep-links to folders.
- **Add the spec in the same PR that asks for review of it.** The auto-comment workflow only fires on `status === 'added'` files, so a spec moved or renamed in a later PR won't re-trigger the comment.
- **Use relative links inside markdown.** Images and cross-references resolve relative to the artefact's path; absolute `/specs/...` links break in the navigator's hash-routed view.
- **Don't commit secrets into `evidence/`.** It renders verbatim — anything you paste is what the reviewer sees.

### 3. Reviewer onboarding

Tell reviewers two things: (a) click the link in the PR comment; (b) the first time they want to leave a comment, the navigator will prompt for a fine-grained PAT scoped to the target repo with `pull-requests: write`. PATs are stored in `localStorage` and never leave the browser. That's the whole onboarding.

### 4. Optional: self-hosted navigator

If you can't use the hosted instance — air-gapped network, custom branding, private specs — fork and deploy (see [Self-hosting](#self-hosting) below). Then set `NAVIGATOR_URL` in the workflow to your fork's Pages URL. The URL contract is identical, so consumers don't need to know which instance they're hitting.

## Configuration

Three things are configurable: the default repo, vendor branding, and the Vite base path. All three have sensible defaults baked in for the hosted instance, so most adopters won't need to change them.

| What | How | Default |
|---|---|---|
| Default repo (when no `?repo=` in URL) | `VITE_DEFAULT_OWNER`, `VITE_DEFAULT_REPO` (build-time env vars) | `debrief/debrief-future` |
| Vite base path | `VITE_BASE` (build-time env var) | `/speckit-navigator/` |
| Per-request consumer | `?repo=<org>/<name>` + `?branch=<branch>` (URL params) | falls back to env defaults |

See [CONFIGURATION.md](./CONFIGURATION.md) for full details.

## Self-hosting

The hosted instance at `https://deepbluecltd.github.io/speckit-navigator/` is sufficient for most consumers — you select your repo via URL parameters at view time. Self-hosting is only needed if you want to:

- bake a different default repo into the build, or
- host under a different path or domain, or
- host a private fork with a custom branding.

To self-host:

1. Fork this repository.
2. Set `VITE_DEFAULT_OWNER`, `VITE_DEFAULT_REPO`, and `VITE_BASE` in your fork's Pages deploy environment (or `VITE_BASE` repo variable).
3. If your repo is private, register a `GITHUB_TOKEN` Actions secret with `metadata:read` and `contents:read` on the target repo (and `repo` if private).
4. Update `live.yml` to point its smoke-test target at your repo (the default targets `debrief/debrief-future`).

Three steps. No further changes needed — the same URL contract works for any consumer.

## Per-PR preview deployments

Every PR gets a preview at `https://deepbluecltd.github.io/speckit-navigator/previews/pr-<number>/`. The `pr-preview.yml` workflow builds the app with a PR-scoped `VITE_BASE`, deploys to the `gh-pages` branch under `previews/pr-<number>/`, and posts (or updates) a comment on the PR with the URL plus a few sample link shapes. When the PR closes, `pr-preview-cleanup.yml` removes that folder.

The bundled `specs/237-active-storyboard-persistence/` is the dummy speckit document-set the preview renders by default (copied from `debrief/debrief-future` so a reviewer with no extra config can confirm the renderer works).

### One-time Pages setup

Pages must be configured to deploy from the `gh-pages` branch, not from GitHub Actions:

1. Open repo Settings → Pages.
2. Source: **Deploy from a branch**.
3. Branch: `gh-pages`, folder: `/ (root)`.
4. Save.

The `gh-pages` branch is created on the first preview push, so trigger any PR build first (or push to `main`) before flipping the source.

## Architecture (one-paragraph summary)

A static React + Vite SPA. No backend. Reads from the GitHub REST + raw-content APIs at request time, validated through Zod at the boundary. Optionally posts comments to PRs via the user's PAT (stored in `localStorage`, never URL-bound). E2E tests run against HTTP fixtures by default; live mode hits real GitHub.

For deep dives, see the spec at the source repository: <https://github.com/debrief/debrief-future/tree/main/specs/248-extract-spec-navigator>.

## Licensing

Same licence as the source repository (`debrief/debrief-future`). See `LICENSE`.

## Security

PATs live in `localStorage` only — never in URLs, never in logs. See [SECURITY.md](./SECURITY.md) for token-rotation policy and reporting procedures.
