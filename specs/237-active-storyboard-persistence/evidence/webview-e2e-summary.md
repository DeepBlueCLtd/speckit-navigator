# Web-shell E2E Summary — #237

**Spec file**: `apps/web-shell/playwright/tests/active-storyboard-persistence.spec.ts`

**Run command**: `cd apps/web-shell && node run-playwright.mjs active-storyboard-persistence`

## Scenarios

| # | Scenario | Coverage | Status |
|---|----------|----------|--------|
| 1 | US1 — picking a non-default Storyboard writes a SystemState feature into the FC | Capture two Storyboards via the live UI, switch via the side-rail dropdown, assert `window.__currentPlotFeatures` contains a `SystemState` feature with `state_type=active_storyboard` and the chosen Storyboard's `properties.id`. | Pass (4.6 s) |
| 2 | US2 — single-Storyboard plot still allows the SystemState feature without breaking the panel | Capture a single Storyboard; assert no spurious SystemState write occurs (no analyst override happened) and the rail renders normally. | Pass (3.3 s) |

**Total**: 2 / 2 passed (10.9 s wall time, single worker).

## Screenshot Index

| Path | Captured by |
|------|-------------|
| `specs/237-active-storyboard-persistence/evidence/screenshots/before-default-fallback.png` | Scenario 1 — captured before the analyst's dropdown override (panel landed on the most-recently-modified Storyboard, today's default rule). |
| `specs/237-active-storyboard-persistence/evidence/screenshots/after-restored-selection.png` | Scenario 1 — captured after the analyst's dropdown override (panel now shows the alternative Storyboard, persisted via the SystemState write). |

The interaction GIF (FR-042 ≤ 5 s, ≤ 2 MB) is **not captured in this run**:
the cloud session lacks `ffmpeg`. The two PNG screenshots cover the
before/after states for the blog post and PR description; the GIF can
be regenerated locally via the same Playwright run + `convertWebmToGif`
helper used by `apps/web-shell/playwright/tests/storyboard-edit-interaction-gif.spec.ts`.

## Traceability

- **SC-001 (100% restore on reopen)**: Verified at the wiring layer by the VS Code service round-trip test (`storyboardPlayback.persistence.test.ts` — "round-trip: after override + reopen the persisted ID is honoured") plus the Playwright in-session write verification. Full-page-reload restoration is structurally proven (the `SystemState` feature lives in the plot file and travels with it via `@debrief/stac-writer`); reload-driven URL state restoration in the web-shell is a separate concern noted by #236.
- **SC-003 (silent fallback on stale records)**: Verified by the VS Code service test (FR-006 + FR-007 — "falls back silently when persisted ID is not in the plot" + "self-heals on open by writing the new default ID through the edit pipeline"). The Playwright run does not assert this scenario directly because pre-seeding a stale `SystemState` entry into the bundled fixture plot would require new app-level plumbing; the unit-test side is authoritative.
- **SC-004 (cross-host parity)**: Structural — the `SystemState` feature lives in the plot file, so a pin set in VS Code is read on the next open in web-shell (and vice versa) without any sync infrastructure. Verified by helper unit tests + LinkML round-trip (Python ↔ JSON ↔ TypeScript on the new `system-state-active-storyboard-01.json` fixture).
