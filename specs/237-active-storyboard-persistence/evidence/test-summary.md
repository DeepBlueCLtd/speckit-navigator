---
feature: "237-active-storyboard-persistence"
captured_at: "2026-05-07T16:20:00Z"
git_sha: "b12e92e"
tests_passed: 4577
tests_failed: 0
tests_skipped: 5
coverage_pct: null
---

# Test Summary: Active-Storyboard Selection Persistence

## Results

| Metric | Value |
|--------|-------|
| Total Tests | 4582 |
| Passed | 4577 |
| Failed | 0 |
| Skipped | 5 (4 pre-existing test skips + 1 xfailed) |
| Coverage | not measured (existing repo convention) |

## Test Breakdown

### Schema round-trip + golden fixtures (Python)

| Test | Status |
|------|--------|
| 802 LinkML / Pydantic / round-trip / golden fixture cases (incl. new `system-state-active-storyboard-01.json`) | Pass |
| Existing fixtures unchanged after additive enum + slot extension | Pass |

### Helper unit tests (`@debrief/components/storyboard/__tests__/activeStoryboardSelection.test.ts`)

| Test | Status |
|------|--------|
| `isActiveStoryboardSelection` true/false matrix (V-1) | Pass |
| `getActiveStoryboardSelection` returns null on empty plot | Pass |
| `getActiveStoryboardSelection` returns first match + warns on duplicates (V-5) | Pass |
| `setActiveStoryboardSelection` upserts (V-3) | Pass |
| `setActiveStoryboardSelection(plot, null)` removes the feature (V-4) | Pass |
| Helpers are pure — input plot never mutated | Pass |
| US3#1 — set on P1 then read on P2 returns null | Pass |
| US3#2 — re-running set on P1 leaves P2 untouched | Pass |
| US3#3 — same Storyboard names across plots do not collide | Pass |
| Edge case — malformed `active_storyboard_id` value emits one log + returns null | Pass |
| **Total: 21 tests** | **All pass** |

### VS Code service-level wiring (`apps/vscode/tests/unit/storyboardPlayback.persistence.test.ts`)

| Test | Status |
|------|--------|
| US1 — preserves today's behaviour when no SystemState entry exists (SC-002) | Pass |
| US1 — honours persisted SystemState selection when ID is valid | Pass |
| US1 — `setActiveStoryboard` writes a Feature mutation through the edit pipeline | Pass |
| US1 — round-trip: override + reopen → persisted ID honoured | Pass |
| US1 — no top-level provenance entry on the SystemState write (FR-014) | Pass |
| US2 — silent fallback to default when persisted ID is stale (FR-006, SC-003) | Pass |
| US2 — open-time self-heal write replaces the stale entry (FR-007) | Pass |
| US2 — no self-heal on first-ever opens (no SystemState entry) | Pass |
| US2 — no self-heal when the persisted ID is still valid | Pass |
| **Total: 9 tests** | **All pass** |

### Web-shell wiring (`apps/web-shell/src/services/__tests__/activeStoryboardPersistence.test.ts`)

| Test | Status |
|------|--------|
| `readPersistedActiveStoryboardId` returns 'absent' on plots without SystemState | Pass |
| `readPersistedActiveStoryboardId` returns 'valid' with the recorded ID | Pass |
| `readPersistedActiveStoryboardId` returns 'stale' on stale IDs | Pass |
| `readPersistedActiveStoryboardId` returns 'stale' on zero-storyboard plots (US2#3) | Pass |
| `persistActiveStoryboardId` upserts via `setFeatureCollection` | Pass |
| `persistActiveStoryboardId` replaces existing entry in place (V-3) | Pass |
| `persistActiveStoryboardId` removes entry on null (V-4) | Pass |
| `persistActiveStoryboardId` does not mutate the input FC | Pass |
| Round-trip: write then read returns the same ID | Pass |
| **Total: 9 tests** | **All pass** |

### Playwright E2E (`apps/web-shell/playwright/tests/active-storyboard-persistence.spec.ts`)

| Test | Status |
|------|--------|
| US1 — picking a non-default Storyboard writes a SystemState feature into the FC | Pass |
| US2 — single-Storyboard plot renders without breaking the panel; no spurious SystemState writes | Pass |
| **Total: 2 tests** | **All pass** |

### Other repo unit suites (regression check)

| Suite | Status |
|------|--------|
| Python (`uv run pytest`) — services, schemas, calc, io, etc. | 1887 passed, 1 skipped, 1 xfailed |
| TypeScript (`pnpm --filter '!@debrief/web-shell' test`) — components, vscode, schemas, session-state, etc. | All pass (no regressions) |
| Existing `apps/vscode/tests/unit/storyboardPlayback.test.ts` (37 tests) | Pass |
| Existing `apps/vscode/tests/unit/mapPanel-storyboardPlayback.test.ts` (8 tests) | Pass |

## Key Scenarios Verified

- **SC-001 — 100% restore on reopen**: Playwright E2E + VS Code service round-trip prove the override → close → reopen flow lands on the pinned Storyboard.
- **SC-002 — default unchanged for first-ever opens**: VS Code service test asserts no SystemState read changes behaviour when the entry is absent.
- **SC-003 — silent fallback on stale IDs**: VS Code service test asserts no error message / banner on the stale path; the panel falls back to `getActiveStoryboardDefault()` cleanly.
- **SC-004 — cross-host parity**: Structural — the SystemState feature lives in the plot file. Verified by helper unit tests (US3 cross-plot independence) + the LinkML round-trip suite (Python ↔ JSON ↔ TypeScript) on the new fixture.
- **SC-005 — additive schema**: All existing 802 schema fixtures pass without modification; new fixture round-trips byte-stable.
- **SC-006 — parse failure tolerated**: Helper unit tests assert that malformed `active_storyboard_id` values return null and emit a single log warning.
- **FR-014 — no provenance pollution**: VS Code service test asserts the SystemState feature's `provenance` slot remains empty on every write.

## Known Issues

- The Playwright E2E for US2 #1 (pre-seeded stale SystemState in a fixture plot) is covered by the VS Code service-level test rather than a browser run, because the web-shell's bundled fixtures are read-only and pre-seeding via query params would require new app-level plumbing. The unit-test side is authoritative for the stale-fallback + self-heal behaviour.

## Environment

- Runner: `uv run pytest` (Python), `pnpm vitest run` (TypeScript), `node apps/web-shell/run-playwright.mjs active-storyboard-persistence` (Playwright)
- Branch: `claude/implement-speckit-237-CnMM1`
- Date: 2026-05-07
