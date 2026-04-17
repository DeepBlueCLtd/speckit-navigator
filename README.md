# @debrief/spec-navigator

Static, browser-based review surface for spec feedback on Debrief pull requests.
The reviewer loads `?pr=<n>`, reads every artefact in the feature's `specs/NNN-*/`
folder, captures feedback at selection / document / feature granularity, and
submits the batch as a single structured PR comment.

**Published at**: `https://debrief.github.io/debrief-future/spec-navigator/`

## Reviewer setup (one-time per device)

1. Generate a **fine-grained personal access token** at
   <https://github.com/settings/personal-access-tokens/new>:
   - **Resource owner**: `debrief`
   - **Repository access**: `debrief/debrief-future`
   - **Permissions**:
     - `Contents: Read` (to read spec artefacts)
     - `Pull requests: Read and Write` (to post the consolidated PR comment)
2. Open the navigator from any PR's body link (or directly at the URL above with
   `?pr=<num>` appended).
3. Click the **⚙ settings** icon, paste the PAT, click **Save token**. The token
   is stored only in `localStorage` on this device and is sent only to GitHub.
4. Review the spec. Click **Submit feedback** to post a single consolidated PR
   comment.

## Local development

```sh
pnpm --filter @debrief/spec-navigator dev       # Vite dev server
pnpm --filter @debrief/spec-navigator build     # tsc + vite build → dist/
pnpm --filter @debrief/spec-navigator test      # Vitest unit tests
node apps/spec-navigator/run-playwright.mjs     # Playwright E2E (cloud/CI)
```

## Troubleshooting

- **"Not authenticated"** — Open settings and paste a PAT. Permission scope
  documented on the settings panel itself.
- **"PR not found"** — Your PAT cannot see the target repo. Regenerate with
  the correct resource owner.
- **"Rate limit hit"** — GitHub's authenticated rate limit is 5000/h; if hit,
  wait an hour or use a different PAT.
- **Draft lost** — Drafts are persisted to `localStorage` under
  `spec-navigator:drafts:pr-<num>`. If clearing browser data is unavoidable,
  submit before doing so.

## Architecture

- Zero backend. Static SPA hosted on GitHub Pages.
- CSP meta tag on `index.html` restricts `connect-src` to
  `api.github.com` and `raw.githubusercontent.com`, so a compromised
  transitive dependency cannot exfiltrate the PAT.
- GitHub REST responses narrowed via `zod` at the fetch boundary (`src/github/schemas.ts`).
- Drafts persisted per-PR in `localStorage`; cleared automatically on successful submit.
