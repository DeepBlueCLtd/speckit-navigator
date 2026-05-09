# Security

## Reporting vulnerabilities

Email `security@debrief.dev` (or open a private security advisory via the GitHub Security tab). Do not file a public issue for security-sensitive reports.

## PAT handling

End-user PATs are stored in browser `localStorage`, scoped to the page origin (`https://debrief.github.io`). They are never:

- placed in URLs (no `?token=` parameter is ever accepted),
- echoed to logs,
- transmitted to any server other than `api.github.com` and `raw.githubusercontent.com`,
- reused across `repo` boundaries without explicit user consent (see `CONFIGURATION.md` → "PAT scoping").

A user can clear their PAT at any time via Settings → Clear token, which removes the `localStorage` entry on the device.

## CI secret: `GITHUB_TOKEN`

The `live.yml` workflow needs a PAT to exercise the real GitHub API against the smoke-test target. Configure it at `Settings → Secrets and variables → Actions → Repository secrets`.

### Recommended scope

A **fine-grained personal access token**, owned by a service identity (not a human contributor), with:

- `metadata: read` (always required for fine-grained tokens),
- `contents: read` (public repos only — sufficient for smoke-testing `debrief/debrief-future`),
- `pull_requests: read` (sufficient for the open-PR smoke check).

Do **not** grant write scopes. The live-mode tests do not modify state.

### Rotation policy

| Event | Action | Timeline |
|---|---|---|
| Service identity password reset | Generate new fine-grained PAT, update `GITHUB_TOKEN`, retire old PAT. | 24h |
| Suspected leak | Revoke the leaked PAT immediately, regenerate, update `GITHUB_TOKEN`, audit Actions logs for unexpected use. | Same-day |
| Periodic rotation | Generate fresh PAT, update `GITHUB_TOKEN`, retire old. | 12 months |

### Why a service identity, not a contributor PAT

Contributor turnover would silently break CI when the contributor's PAT expires or their account is suspended. A service identity decouples CI from any individual's account state.

## Adopter forks

If you fork spec-navigator for a private repo, you will need a PAT with `repo` scope rather than the public-only scopes above. Document it in your fork's `SECURITY.md`. The CI surface remains the same; only the secret's contents differ.

## Public-key fingerprints

Not applicable — this app ships no compiled binaries and is not signed.
