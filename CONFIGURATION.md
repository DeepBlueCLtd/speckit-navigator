# Configuration reference

spec-navigator has a deliberately small configuration surface: two build-time env vars for the default consumer, one for the Vite base path, and a small URL contract for selecting the per-request consumer.

There is **no** runtime config file, no `Configuration` JSON Schema, and no in-app settings UI for choosing the target repo. The decision (recorded as `/speckit.review` decision 2A in the source spec at `debrief/debrief-future:specs/248-extract-spec-navigator/`) was that the existing `ApiOptions` typed seam plus three named constants in `strings.ts` is sufficient — adding a `Configuration` entity would just duplicate the seam without earning its keep.

## Build-time environment variables

Set these as repository variables (Settings → Secrets and variables → Actions → Variables) or via your CI's environment:

| Variable | Purpose | Default | Used by |
|---|---|---|---|
| `VITE_DEFAULT_OWNER` | GitHub org / user owning the default consumer | `debrief` | `src/defaults.ts` |
| `VITE_DEFAULT_REPO` | Repo name owned by `VITE_DEFAULT_OWNER` | `debrief-future` | `src/defaults.ts` |
| `VITE_BASE` | Path the SPA is hosted at | `/spec-navigator/` | `vite.config.ts` |

When all three URL-contract parameters are absent (no `?repo=`, no `?branch=`, no `?pr=`), the SPA loads with the build-time defaults baked in by these variables.

## URL contract

The hosted SPA accepts three URL query parameters. All are optional.

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `repo` | `<org>/<name>` | `${VITE_DEFAULT_OWNER}/${VITE_DEFAULT_REPO}` | Must match `^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`. Bad values fall back to the default with a non-blocking warning banner. |
| `branch` | branch name | consumer's default branch | URL-encoded slashes are accepted (`feat%2Fx`) and so are raw slashes (`feat/x`). |
| `pr` | digits | — | **Legacy form.** Resolves the PR number against `${VITE_DEFAULT_OWNER}/${VITE_DEFAULT_REPO}`, then proceeds as if `?repo=…&branch=<resolved>` had been supplied. |

### Resolution precedence

1. Build-time env vars set the *defaults* (highest priority for "what does an unparameterised URL render?").
2. `?repo=` and `?branch=` override the defaults at request time.
3. `?pr=` is a shortcut for "look up branch by PR number, on the default repo".
4. If both `?repo=`/`?branch=` and `?pr=` are present in the same URL, the explicit `?repo=`/`?branch=` form wins; `?pr=` is ignored, and a non-blocking note appears in the page footer.

### Explicit non-parameters

The following are **never** accepted from URLs, even if present:

| Parameter | Why not |
|---|---|
| `pat`, `token`, `auth` | PATs travel through `localStorage` only. URL-bound credentials would leak into browser history, server logs, and `Referer` headers. |
| `specsPath`, `featureDirPattern`, `artefactFilenames`, `branding.*` | Repository-shape configuration is bake-time, not request-time. Adopters who want different defaults fork the source. |

Unknown parameters are silently ignored to keep deep-links forward-compatible.

## Examples

```
# Default — VITE_DEFAULT_OWNER / VITE_DEFAULT_REPO
https://debrief.github.io/spec-navigator/

# Legacy form — debrief-future PR shortcut
https://debrief.github.io/spec-navigator/?pr=512

# New form — non-debrief consumer
https://debrief.github.io/spec-navigator/?repo=acme/our-platform

# Specific branch on the default repo
https://debrief.github.io/spec-navigator/?repo=debrief/debrief-future&branch=claude/foo

# Deep link to a feature folder
https://debrief.github.io/spec-navigator/?repo=acme/foo&branch=main#/specs/123-bar
```

## PAT scoping

The user's PAT is associated with the `repo` parameter at the time it was saved. When the resolved `repo` differs from the PAT's home, the SPA shows a one-time consent prompt before sending the cached PAT to the new repo's API calls. This prevents cross-org credential drift — a PAT scoped to `debrief/debrief-future` is never silently reused for `acme/our-platform`.

## Self-hosting checklist

To deploy a forked spec-navigator pointing at your own repo:

1. Fork this repository to your org.
2. In your fork, set `VITE_DEFAULT_OWNER` and `VITE_DEFAULT_REPO` (Variables) to your repo's coordinates.
3. (If hosting under a different path) set `VITE_BASE`.
4. (If your repo is private) register a `GITHUB_TOKEN` secret with sufficient scopes for live-mode CI.
5. Update `live.yml`'s test target from the hardcoded `debrief/debrief-future` reference to your own repo.

That's it. The URL contract works identically for any consumer.
