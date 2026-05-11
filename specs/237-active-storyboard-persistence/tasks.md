---
description: "Task list for #237 — Active-Storyboard Selection Persistence (Path D — in-plot SystemState)"
---

# Tasks: Active-Storyboard Selection Persistence

**Input**: Design documents from `/specs/237-active-storyboard-persistence/`
**Prerequisites**: spec.md, plan.md, research.md, data-model.md, quickstart.md (all rewritten 2026-05-07 for Path D — in-plot SystemState persistence)

**Tests**: This feature includes test tasks throughout — required by Articles VI / VII / XV and explicitly mapped in `quickstart.md` §Testing.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested as an independent slice. The acceptance-scenario → test-file mapping in `quickstart.md` is the source of truth for what each phase delivers.

> **Note on history**: An earlier draft of this task list (v1, 2026-05-06)
> covered a per-host adapter design (`@debrief/config` + `localStorage`).
> On `/speckit.review` the user directed in-plot persistence via the
> existing `SystemState` LinkML pattern. This is the Path D rewrite.
> Differences from v1: schema bump replaces ESLint exception; pure
> helpers replace per-host adapters; existing `@debrief/stac-writer`
> pipeline replaces conformance suite. Net file count is smaller.

---

## Evidence Requirements

> **Purpose**: Capture artifacts that demonstrate the feature works as expected. Used in PR descriptions, the feature blog post, and as the source of record for future regression checks.

**Evidence Directory**: `specs/237-active-storyboard-persistence/evidence/`
**Media Directory**: `specs/237-active-storyboard-persistence/media/`

### Planned Artifacts

| Artifact | Description | Captured When |
|----------|-------------|---------------|
| `evidence/test-summary.md` | Aggregated pass/fail counts for the new schema fixture, helper unit suite, service / component wiring tests, and Playwright E2E. YAML front matter (`feature`, `captured_at`, `git_sha`, `tests_passed`, `tests_failed`, `tests_skipped`, `coverage_pct`) per the `.specify/templates/evidence/test-summary-template.md` template. | After all tests pass (Polish phase) |
| `evidence/usage-example.md` | Two short snippets: (a) the helper round-trip — `setActiveStoryboardSelection(plot, B)` → write through plot pipeline → reopen → `getActiveStoryboardSelection(plot) === B`; (b) a TypeScript host-wiring snippet showing `onPlotOpened` calling the helper and routing the write through the existing edit pipeline | After helpers are implemented |
| `evidence/screenshots/before-default-fallback.png` | Side-rail header screenshot of the panel landing on `getActiveStoryboardDefault()` (today's behaviour, still the first-ever-open behaviour after #237) | During the Playwright run that captures interaction.gif |
| `evidence/screenshots/after-restored-selection.png` | Side-rail header screenshot of the panel landing on the previously-pinned Storyboard after a page reload | Same Playwright run |
| `evidence/screenshots/interaction.gif` | < 5 s, < 2 MB GIF: open plot → pick a non-default Storyboard from the dropdown → reload page → panel still on the picked Storyboard. Captured via the same web-shell Playwright spec used for the E2E test | Polish phase |
| `evidence/webview-e2e-summary.md` | Pass / fail summary for `apps/web-shell/playwright/tests/active-storyboard-persistence.spec.ts`, including the two scenarios (US1 happy path + US2 stale fallback) and a screenshot index | Polish phase |

### Media Content

| Artifact | Description | Created When |
|----------|-------------|--------------|
| `evidence/opening-context.md` | Cached opener — Hook (before/after table) + What We're Building + How It Fits + Key Decisions. **Already created during the previous `/speckit.plan`; the user-visible flow is unchanged by the Path D pivot, so the opener remains valid.** Spot-check during Polish for any wording that referenced the old per-host design. | **Already created** ✓ (review in Polish) |
| `media/shipped-post.md` | Feature post combining the cached opener with screenshots, By the Numbers, Lessons Learned, What's Next | Polish phase (Content Specialist) |

### PR Creation

| Action | Description | Created When |
|--------|-------------|--------------|
| Feature PR | PR in `debrief/debrief-future` with full evidence and the spec dir as the source of truth | Final task in Polish phase (via `/speckit.pr`) |
| Blog PR | Cross-repo PR in `debrief/debrief.github.io` publishing the feature post | Triggered by `/speckit.pr` |

---

## Phase 1: Schema Bump (Foundation)

**Purpose**: Extend the LinkML schema additively (one new permitted enum value, one new optional slot), regenerate the derived artefacts, and add one fixture covering the new `SystemState` variant. Every downstream task imports from the regenerated types; nothing else can begin until Phase 1 is green.

**⚠️ CRITICAL**: No helper, host-wiring, or test work can begin until Phase 1 is complete. All TypeScript code in later phases imports the regenerated `SystemStateProperties` type with the new optional `active_storyboard_id` slot.

- [x] T001 Add `active_storyboard` to `SystemStateTypeEnum.permissible_values` in `shared/schemas/src/linkml/common.yaml` (alongside `temporal`, `spatial`, `selection`). Description: "Per-plot active-Storyboard pin (#237)". This is a strictly additive change — existing fixtures still validate `shared/schemas/src/linkml/common.yaml`
- [x] T002 Add an optional `active_storyboard_id: string` slot under `SystemStateProperties.attributes` in `shared/schemas/src/linkml/geojson.yaml`, with description "Storyboard properties.id the analyst last pinned for this plot (#237)". Place it alongside the existing `state_type`-discriminated field clusters (`# Active-storyboard fields (when state_type = active_storyboard)` block) and update the `state_type` description to mention the new variant `shared/schemas/src/linkml/geojson.yaml`
- [x] T003 Regenerate the derived schema artefacts from the LinkML edits. Run the existing schema regen (typically `task schemas` or `pnpm --filter @debrief/schemas regen`; check `shared/schemas/README.md` for the canonical command). Verifies that gen-pydantic, gen-json-schema, and gen-typescript all accept the additive change. Commits the regenerated files under `shared/schemas/src/generated/`. Spot-check that `SystemStateProperties` in `generated/typescript/types.ts` now exposes `active_storyboard_id?: string` and that `SystemStateTypeEnum` includes `active_storyboard` `shared/schemas/src/generated/`
- [x] T004 [test] Add one new schema fixture: a plot FeatureCollection containing two Storyboards plus one `SystemState` feature with `kind: SYSTEM`, `state_type: active_storyboard`, `id: state.activestoryboard`, `geometry: {type: Point, coordinates: []}`, and `properties.active_storyboard_id` referencing one of the Storyboards. Place under `shared/schemas/src/fixtures/` matching the existing fixture file convention; ensure the existing schema round-trip suite (Python ↔ JSON ↔ TypeScript) picks it up. Existing fixtures must continue to pass without modification (additive change verified) `shared/schemas/src/fixtures/active-storyboard-selection.json` (or matching naming convention)
- [x] T005 [test] Run the existing schema test suites and confirm pass: (a) LinkML adherence tests; (b) Python ↔ JSON ↔ TypeScript round-trip; (c) golden fixture comparison. The new fixture from T004 round-trips byte-stable; existing fixtures pass unchanged. If any existing fixture fails, the schema change is not actually additive — investigate and fix before proceeding. Pass condition gates Phase 2 entry

**Checkpoint**: LinkML schema extended additively; derived artefacts regenerated; new fixture round-trips Python ↔ JSON ↔ TS; existing fixtures still pass. The schema part of Article II is complete.

---

## Phase 2: Helpers (Pure Foundation)

**Purpose**: Three pure functions on the FeatureCollection — one type-guard plus a getter and a setter — in `shared/components/src/storyboard/`. Mirrors the existing `isStoryboardFeature` / `isSceneFeature` / `getActiveStoryboardDefault` pattern. No I/O, no React, no host coupling. Every host-wiring task in Phase 3+ imports these.

**⚠️ CRITICAL**: Phase 3 host-wiring blocks on Phase 2.

- [x] T006 [test] Write the helper unit tests covering all V-1 through V-5 invariants from data-model.md: (a) `isActiveStoryboardSelection` true/false matrix against SYSTEM features with each `state_type`, against non-SYSTEM features, and against malformed input; (b) `getActiveStoryboardSelection(plot)` returns null on empty plot, null on plot without the variant, the recorded ID on a valid plot, the first match with a non-fatal log warning when duplicates exist (V-5); (c) `setActiveStoryboardSelection(plot, id)` upserts (V-3): writing twice yields one feature not two, the ID matches the most recent write; (d) `setActiveStoryboardSelection(plot, null)` removes the feature (V-4); (e) the helpers are pure — passing the same plot twice never mutates the input. Use Vitest in the same style as `shared/components/src/storyboard/__tests__/types.test.ts` (or whatever the existing storyboard helper test file is) `shared/components/src/storyboard/__tests__/activeStoryboardSelection.test.ts`
- [x] T007 Implement the three helpers as pure functions: `isActiveStoryboardSelection(feature): feature is SystemStateFeature & { properties: { state_type: 'active_storyboard' } }` (type-guard); `getActiveStoryboardSelection(plot: FeatureCollection): string | null` (scan-and-return-first, V-5 de-dup logging via the existing shared logger); `setActiveStoryboardSelection(plot: FeatureCollection, id: string | null): FeatureCollection` (upsert / delete, V-3 / V-4). Constants: `ACTIVE_STORYBOARD_FEATURE_ID = 'state.activestoryboard'`, `ACTIVE_STORYBOARD_STATE_TYPE = 'active_storyboard'`. Use the regenerated TypeScript types from `@debrief/schemas` (Phase 1) — no `any` `shared/components/src/storyboard/activeStoryboardSelection.ts`
- [x] T008 [P] Re-export `isActiveStoryboardSelection`, `getActiveStoryboardSelection`, `setActiveStoryboardSelection` from the storyboard barrel so both hosts can import via `@debrief/components` `shared/components/src/storyboard/index.ts`

**Checkpoint**: Three helpers exist, are pure, are unit-tested, and re-exported. Run `pnpm --filter @debrief/components test activeStoryboardSelection` — all pass. Phase 3 work can now begin in parallel.

---

## Phase 3: User Story 1 — Reopened plot lands on the last-pinned Storyboard (P1)

**Goal**: After an analyst overrides the active Storyboard via the side-rail header dropdown and then closes + reopens the plot, the panel reopens on that Storyboard — in either host. First-ever opens of plots that have never been pinned continue to behave exactly as today (`getActiveStoryboardDefault()`).

**Independent Test**: Open a multi-storyboard fixture plot in the web-shell. Confirm the panel lands on the most-recently-modified Storyboard. Pick a different Storyboard via the dropdown. Reload the page. Verify the panel header still shows the picked Storyboard and the scene list reflects it. Repeat the close-reopen cycle a second time without further interaction; the picked Storyboard must still be selected.

> **⚠️ PLAYWRIGHT WORKS IN CLOUD SESSIONS** — `apps/web-shell/run-playwright.mjs` extracts the bundled `@sparticuz/chromium` binary and configures Playwright to use it. Do **not** route the user-visible test through openvscode-server / `xvfb-run`. Full details: `docs/project_notes/playwright-installation-research.md`.

This phase has two parallel tracks (VS Code wiring ‖ web-shell wiring) plus a final E2E. The two tracks share no files; they synchronise only at the Playwright spec.

### VS Code track — write-then-implement, sequenced

- [x] T009 [P][test] [US1] Write VS Code service-level test for `StoryboardPlaybackService` against an in-memory fake plot and a fake plot-edit pipeline (records emitted Feature mutations, no real backend). Assertions: (a) on a fresh `onPlotOpened` with no `SystemState` feature in the plot, `state.activeStoryboardId === getActiveStoryboardDefault(plot).properties.id` (preserves today's behaviour — SC-002); (b) after `setActiveStoryboard(documentUri, B)`, the fake pipeline records exactly one Feature mutation upserting the `SystemState` feature with `active_storyboard_id: B`; (c) on a subsequent `onPlotOpened` for the same plot (now containing the upserted SystemState feature), `state.activeStoryboardId === B`; (d) the plot's top-level `provenance` chain is byte-identical before and after the override (FR-014); (e) the `SystemState` feature's own `provenance` field is empty after the write (FR-014 — no provenance entry on the SystemState feature itself either) `apps/vscode/src/services/__tests__/storyboardPlayback.persistence.test.ts`
- [x] T010 [P] [US1] Wire persistence into `StoryboardPlaybackService`: (a) in `onPlotOpened` (around line 240–271), AFTER the existing `state.activeStoryboardId = active?.properties.id ?? null` (line 265), call `getActiveStoryboardSelection(plot)`; if it returns a non-null Storyboard ID **and** that ID is present in `plot.features` (use `isStoryboardFeature` to check), overwrite `state.activeStoryboardId`. No V-2 self-heal in US1 — that lands in Phase 4; (b) in `setActiveStoryboard` (around line 360–374), AFTER the existing `state.activeStoryboardId = storyboardId` write (line 367), build the upserted FeatureCollection via `setActiveStoryboardSelection(plot, storyboardId)` and emit the resulting Feature mutation through the existing plot-edit pipeline (the same pipeline `setActiveStoryboard` already uses if it edits the plot today; if it does NOT yet edit the plot, locate the storyboard CRUD's pipeline call site in `apps/vscode/src/services/storyboardEdit.ts` and route through it). Wrap in try/catch as belt-and-braces; the helper is pure but the pipeline can fail (#236 / #242 failure UX takes over) `apps/vscode/src/services/storyboardPlayback.ts`

### Web-shell track — write-then-implement, sequenced

- [x] T011 [P][test] [US1] Write the RTL component test for `StoryboardPanelMount` covering the happy path: (a) mount with a plot that has no `SystemState` feature with `state_type: active_storyboard` — `activeOverrideId` matches `getActiveStoryboardDefault(plot).properties.id` (US1#2 — preserves today's behaviour); (b) mount with a plot pre-seeded with the SystemState feature pointing at Storyboard `B` (where `B` is in the plot) — `activeOverrideId` equals `B`; (c) on `onActiveStoryboardChange(C)`, the fake plot-edit pipeline records exactly one Feature mutation upserting the SystemState feature with `active_storyboard_id: C` before the next render; (d) on a single-Storyboard plot, the SystemState feature is still allowed to be present without breaking the panel (Edge case from spec). Use a fake plot-edit pipeline injected via prop / context (mirroring how the test for `StoryboardPanelMount` already injects the pipeline today) `apps/web-shell/src/__tests__/StoryboardPanelMount.persistence.test.tsx`
- [x] T012 [P] [US1] Wire persistence into `StoryboardPanelMount`: (a) replace `const [activeOverrideId, setActiveOverrideId] = React.useState<string | null>(null)` (lines 189–191) with a `React.useState` initialised by reading `getActiveStoryboardSelection(plot)` once on first render, plus a `useEffect` keyed on `(plot)` that re-reads when the plot changes (resets across plots); (b) in every `setActiveOverrideId(storyboardId)` call site (around lines 320–325 dropdown handler and line 361 post-create), follow with a Feature mutation: build the upserted FeatureCollection via `setActiveStoryboardSelection(plot, storyboardId)` and emit through the host's existing plot-edit pipeline (the same pipeline already used by storyboard CRUD writes from #235). Keep the existing stale-override useEffect at lines 214–218 untouched — V-2 plot-membership validation lands in Phase 4 `apps/web-shell/src/StoryboardPanelMount.tsx`

### E2E — synchronisation point

- [x] T013 [test] [US1] Write the Playwright E2E for the happy-path workflow in the web-shell. Test: open a multi-storyboard fixture plot via the catalog picker (extend the existing `AnalysisPage` page-object — do NOT introduce a new page-object); read the default selection from `[data-testid="storyboard-active-name"]`; click the header dropdown; click a non-default Storyboard option; assert the active selection updates; reload the page (`page.reload()`); assert the dropdown still shows the chosen Storyboard and `[data-testid="storyboard-scene-row"]` rows belong to that Storyboard. Mirror the path-resolution pattern in `apps/web-shell/playwright/tests/properties-screenshots.spec.ts` so the screenshots / GIF land directly under `specs/237-active-storyboard-persistence/evidence/screenshots/` `apps/web-shell/playwright/tests/active-storyboard-persistence.spec.ts`
- [x] T014 [US1] Run the Playwright E2E (`cd apps/web-shell && node run-playwright.mjs active-storyboard-persistence`). Confirm the happy-path scenario passes locally / in cloud. Capture the trace artefacts. The screenshot capture for the blog post is handled in Polish; this task is pass-confirmation only

**Parallel example for Phase 3** (two terminals / two agents):

```bash
# Terminal A — VS Code track
T009 → T010

# Terminal B — Web-shell track
T011 → T012

# Then both terminals join:
T013 → T014
```

**Checkpoint**: User Story 1 is fully functional and independently testable. The Playwright E2E proves the user-visible "open → switch → reload → still-switched" flow on the web-shell; the Vitest service test proves the same flow at the wiring level on the VS Code side. Tests for stale fallback (US2) and per-plot independence (US3) are not yet asserted — those land in Phase 4 and Phase 5.

---

## Phase 4: User Story 2 — Robust fallback when the remembered Storyboard is gone (P2)

**Goal**: When the recorded `active_storyboard_id` is no longer present in the plot (deleted in another session, plot edited offline, etc.), the panel falls back to `getActiveStoryboardDefault()` silently — no banner, no toast, no modal — and the stale `SystemState` feature self-heals on the next moment a fresh selection is established (open-time self-heal write or analyst override).

**Independent Test**: Pre-seed the fixture plot with a `SystemState` feature whose `active_storyboard_id` is NOT present in the plot. Open the plot. Verify the panel shows the most-recently-modified surviving Storyboard (today's default rule) and no error UI is visible. Close and reopen; the persisted `SystemState` feature now references the default Storyboard (or whatever the analyst overrode to).

This phase implements two additions on top of US1's wiring:

1. **V-2 plot-membership validation** — when `getActiveStoryboardSelection(plot)` returns a non-null Storyboard ID, the host validates it is present in `plot.features` before using it. If not present, the host ignores the return value and falls back to `getActiveStoryboardDefault(plot)`.
2. **Open-time self-heal write** — when the host falls back because `getActiveStoryboardSelection` returned a stale ID (not because it returned null — first-ever opens stay clean), the host writes the chosen fallback Storyboard's ID through the plot-edit pipeline. Next reopen of the same plot finds a fresh, valid record.

The two tracks (VS Code ‖ web-shell) run in parallel; the E2E adds one more scenario to the spec file from Phase 3.

- [x] T015 [P][test] [US2] Extend the VS Code service-level test with three new assertions: (a) given a plot pre-seeded with a `SystemState` feature whose `active_storyboard_id` is `STALE` (NOT in the plot's storyboards), `onPlotOpened` results in `state.activeStoryboardId === getActiveStoryboardDefault(plot).properties.id` (silent fallback — FR-006, SC-003); (b) the same fallback path causes the fake plot-edit pipeline to record exactly one self-heal Feature mutation upserting the SystemState feature with the default Storyboard's ID, before `onPlotOpened` returns (FR-007); (c) the host emits no banner / toast / modal on the stale path (verified by asserting no `vscode.window.showWarningMessage` or equivalent was called via spy) `apps/vscode/src/services/__tests__/storyboardPlayback.persistence.test.ts`
- [x] T016 [P][test] [US2] Extend the web-shell RTL component test with: (a) mount with a plot pre-seeded with a SystemState feature whose `active_storyboard_id` is `STALE` (NOT in the plot's storyboards) — assert `activeOverrideId` becomes `null` (so the existing fallback-via-`getActiveStoryboardDefault` path kicks in) and the fake plot-edit pipeline records exactly one self-heal upsert Feature mutation with the default's ID (US2#1, US2#2); (b) mount with the SystemState feature pre-seeded but the plot containing zero Storyboards — assert the existing #235 empty-state UX renders unchanged and no persistence-specific element is in the DOM (US2#3 / Edge case); (c) DOM contains no `[data-testid="error-banner"]` (or whichever no-error selector the panel uses today) on the stale path `apps/web-shell/src/__tests__/StoryboardPanelMount.persistence.test.tsx`
- [x] T017 [P] [US2] Add V-2 validation + open-time self-heal write to `StoryboardPlaybackService.onPlotOpened`: after the US1 read, check `state.activeStoryboardId` is present in `plot.features` (use the same iteration `getActiveStoryboardDefault` performs, or a small `findStoryboardById` helper); if it isn't, reset `state.activeStoryboardId` to `getActiveStoryboardDefault(plot)?.properties.id ?? null` and emit a self-heal Feature mutation through the plot-edit pipeline via `setActiveStoryboardSelection(plot, state.activeStoryboardId)`. The self-heal write is conditional: only fires when the resolved ID differs from what the helper returned (no redundant writes when the persisted value was already valid, no redundant writes on first-ever opens where the helper returned `null`) `apps/vscode/src/services/storyboardPlayback.ts`
- [x] T018 [P] [US2] Add V-2 validation + open-time self-heal write to `StoryboardPanelMount`'s mount-time read effect: after `getActiveStoryboardSelection(plot)`, validate the returned ID against `plot.features`; if absent, set `activeOverrideId` to `null` (so the existing fallback-via-`getActiveStoryboardDefault` path kicks in) and emit a self-heal Feature mutation via `setActiveStoryboardSelection(plot, getActiveStoryboardDefault(plot)?.properties.id ?? null)` through the host's plot-edit pipeline. The conditional-write rule from T017 applies here too (no self-heal on first-ever opens) `apps/web-shell/src/StoryboardPanelMount.tsx`
- [x] T019 [test] [US2] Add a second scenario to the Playwright spec file: load a fixture plot pre-seeded with a `SystemState` feature whose `active_storyboard_id` does NOT exist in the plot; assert the dropdown shows the most-recently-modified surviving Storyboard's name; assert no error/banner element is visible; reload once more; assert the persisted plot's SystemState feature now contains the default Storyboard's ID (self-heal verification — read back via the existing `@debrief/stac-writer` test harness or a Playwright fetch against the served STAC payload, mirroring how other E2E tests verify written state) `apps/web-shell/playwright/tests/active-storyboard-persistence.spec.ts`
- [x] T020 [US2] Re-run the Playwright E2E suite to confirm both Phase-3 and Phase-4 scenarios pass (`cd apps/web-shell && node run-playwright.mjs active-storyboard-persistence`)

**Checkpoint**: User Story 2 is functional. Stale records resolve silently and self-heal. The panel UX from #235 is unchanged on the empty-state path. User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 — Independent persistence across plots (P3)

**Goal**: Each plot has its own `SystemState` feature inside its own FeatureCollection. Pinning Storyboard `B1` for plot `P1` cannot affect plot `P2`'s pinned selection. Storyboards with the same name but different IDs (across plots) do not collide.

**Independent Test**: Pin `P1` to `B1` and `P2` to `B2`. In any open / close order, each plot reopens on its own pinned selection. Re-pin `P1` to `B1'`; `P2`'s SystemState feature is unchanged.

US3 is structurally satisfied by Path D — the SystemState feature lives in each plot's own FeatureCollection, so per-plot independence is an invariant of the storage shape, not behaviour to add. This phase consists of **one verification task** to ensure the helper unit suite explicitly names the three US3 scenarios.

- [x] T021 [test] [US3] Audit `activeStoryboardSelection.test.ts` (the Phase-2 helper unit suite from T006) and confirm three named test cases assert each US3 acceptance scenario: (a) `'US3#1 — set on plot P1 then read on plot P2 returns null (different FeatureCollections cannot collide)'`, (b) `'US3#2 — re-running setActiveStoryboardSelection on P1 leaves P2 untouched (helpers are pure — operating on one FeatureCollection cannot mutate another)'`, (c) `'US3#3 — same Storyboard names across plots do not collide (the helper keys on (FeatureCollection identity, properties.id), not name)'`. If any of these is implicit / unnamed in T006, add it as a new `it(...)` block now. No production code changes in this phase `shared/components/src/storyboard/__tests__/activeStoryboardSelection.test.ts`

**Checkpoint**: All three user stories are independently testable. The full feature is functional. The codebase is ready for evidence collection and PR creation.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Capture evidence, write the feature blog post, and open the PR. No code changes after this point unless review feedback warrants them.

### Pre-flight verification

- [x] T022 Run the full pre-push CI pipeline (`task verify`) and confirm lint, typecheck, unit tests, schema round-trip, and the new Playwright spec all pass. If any step fails, fix the underlying issue (do NOT skip hooks). This is the gate that guarantees Article II / VI / XV compliance before evidence capture

### Evidence Collection (REQUIRED)

> **⚠️ PLAYWRIGHT WORKS IN CLOUD SESSIONS** — `apps/web-shell/run-playwright.mjs` extracts the bundled `@sparticuz/chromium` binary. Full details: `docs/project_notes/playwright-installation-research.md`.

- [x] T023 [P] Capture the test summary using the template at `.specify/templates/evidence/test-summary-template.md` — populate the YAML front matter (`feature: 237-active-storyboard-persistence`, `captured_at`, `git_sha`, `tests_passed`, `tests_failed`, `tests_skipped`, `coverage_pct`) and the body (totals plus the named scenarios from US1, US2, US3 — pulling counts from the most recent `task verify` run from T022) `specs/237-active-storyboard-persistence/evidence/test-summary.md`
- [x] T024 [P] Create the usage example: a TypeScript snippet that imports `getActiveStoryboardSelection` / `setActiveStoryboardSelection` from `@debrief/components/storyboard`, shows a host-side mount-time read and a dropdown-driven write (route through the host's plot-edit pipeline), and a one-paragraph explanation of when each runs. Include a tiny reference to the user-facing flow ("close the plot, reopen it, the selection is restored — no UI change visible to the analyst, the SystemState feature travels with the plot file") `specs/237-active-storyboard-persistence/evidence/usage-example.md`
- [x] T025 [P] Run the web-shell Playwright spec with screenshot capture enabled (`cd apps/web-shell && node run-playwright.mjs active-storyboard-persistence`) and copy the produced screenshots into the feature evidence dir as `before-default-fallback.png` (the default-selection state from a fresh open) and `after-restored-selection.png` (the restored state after reload). Mirror the path-resolution pattern in `apps/web-shell/playwright/tests/properties-screenshots.spec.ts` so the spec writes directly into the evidence dir `specs/237-active-storyboard-persistence/evidence/screenshots/`
- [x] T026 [P] Capture the interaction GIF — record a < 5 s clip via Playwright's `recordVideo` showing: panel opens on default → analyst clicks dropdown → picks Storyboard B → page reloads → panel still on B. Convert to GIF with `ffmpeg` (target < 2 MB; common pattern: `ffmpeg -i recording.webm -filter_complex "[0:v] fps=12,scale=720:-1:flags=lanczos" -t 5 interaction.gif`). Save the GIF and discard the source `.webm` `specs/237-active-storyboard-persistence/evidence/screenshots/interaction.gif`
- [x] T027 Document the web-shell E2E results — list the two Playwright scenarios (US1 happy path + US2 stale fallback), their pass/fail status, the screenshot index from T025 / T026, and a one-line traceability note for SC-001 / SC-003 / SC-004. Mirror the format used by other specs' `webview-e2e-summary.md` files in this repo `specs/237-active-storyboard-persistence/evidence/webview-e2e-summary.md`
- [x] T028 Spot-check `evidence/opening-context.md` (created during the previous `/speckit.plan` and preserved through the Path D pivot — the user-visible flow is unchanged). Look for any wording that referenced the old per-host adapter design (e.g. "stored in user-config", "browser localStorage", "per-machine") and rewrite to reflect Path D semantics ("stored inside the plot file as a SystemState feature", "travels with the plot", "any analyst opening the plot lands on the most recent pin"). If no such wording exists, mark the file unchanged in the commit message `specs/237-active-storyboard-persistence/evidence/opening-context.md`

### Media Content

- [x] T029 Spawn the Content Specialist (read `.claude/agents/media/content.md` first) and ask it to write the **Feature Post** for `media/shipped-post.md`. The agent MUST: (a) copy `## What We're Building`, `## How It Fits`, `## Key Decisions` **verbatim** from `evidence/opening-context.md` (after the T028 spot-check); (b) place the Hook (the before/after table from `opening-context.md`) at the very top with no `## Hook` heading; (c) write fresh `## Screenshots` (referencing T025 / T026 artefacts), `## By the Numbers` (from `evidence/test-summary.md`), `## Lessons Learned` (include "we discovered the existing SystemState LinkML pattern was schema-defined but unconsumed; this feature became its first runtime client — a good lesson on grepping the schema source before designing a new persistence backend"), `## What's Next` sections; (d) populate front matter (`layout: future-post`, `title: "Building Active-Storyboard Selection Persistence"`, `track: [credibility]`, `author: Ian`, calculated `reading_time`, `excerpt` ≤ 150 chars, lowercase tags) `specs/237-active-storyboard-persistence/media/shipped-post.md`

### PR Creation

- [x] T030 Create the PR and publish the blog post by running `/speckit.pr`. The command opens the feature PR in `debrief/debrief-future` (with the spec dir, evidence, and media all linked) and the cross-repo PR in `debrief/debrief.github.io` publishing `media/shipped-post.md`. Returns both PR URLs

**Task T030 must run last. It depends on every preceding task — every test passing, every evidence file written, and the feature post in place.**

---

## Dependencies

### Phase Dependencies

- **Phase 1 (Schema, T001–T005)** — no dependencies; can start immediately. Blocks every Phase 2+ task because they import the regenerated TypeScript types.
- **Phase 2 (Helpers, T006–T008)** — depends on Phase 1 completion. Blocks every host-wiring task in Phases 3–5 (they import the helpers).
- **Phase 3 (US1, T009–T014)** — depends on Phase 2 completion. The two host tracks (T009 + T010 ‖ T011 + T012) run in parallel; both must complete before T013 (the Playwright spec needs the web-shell wiring fully in place).
- **Phase 4 (US2, T015–T020)** — depends on Phase 3 completion. The two host tracks (T015 + T017 ‖ T016 + T018) run in parallel; T019 + T020 sync at the E2E.
- **Phase 5 (US3, T021)** — depends on Phase 2 (the helper unit suite). Independent of Phases 3 and 4 in principle (the test it audits is at the helper layer, not the host layer), but in practice runs after Phase 4 because the auditing task is cheap and the codebase is then known-green.
- **Phase 6 (Polish, T022–T030)** — depends on Phases 1–5. T022 gates evidence capture; T023–T027 run after T022; T028 reviews the cached opener; T029 reads the evidence dir; T030 runs last.

### Within-Phase Dependencies

**Phase 1** (`T001 ‖ T002 → T003 → T004 → T005`):
- T001 ‖ T002 — different files, no dependency.
- T003 (regen) blocks on both T001 and T002.
- T004 (fixture) blocks on T003 (uses regenerated types).
- T005 (run round-trip) blocks on T004.

**Phase 2** (`T006 → T007 → T008`):
- T006 (test) blocks T007 (TDD order — test first).
- T007 (impl) blocks T008 (re-export imports the symbols).

**Phase 3** (two parallel tracks):
- VS Code track: `T009 → T010`. TDD order — test first, then implementation.
- Web-shell track: `T011 → T012`. Same TDD order.
- Both tracks independent: VS Code touches `apps/vscode/**`, web-shell touches `apps/web-shell/**`; the only shared code is in `shared/components/**` (already complete in Phase 2).
- Sync point: `{T010, T012} → T013 → T014`. The Playwright spec consumes the web-shell wiring; the run consumes the spec.

**Phase 4** (two parallel tracks again):
- VS Code: `T015 → T017`. Test first, then V-2 + self-heal in `storyboardPlayback.ts`.
- Web-shell: `T016 → T018`. Test first, then V-2 + self-heal in `StoryboardPanelMount.tsx`.
- Sync point: `{T017, T018} → T019 → T020`. Playwright spec extension consumes both V-2 implementations.

**Phase 6**:
- `T022 → {T023, T024, T025, T026, T028}`. Pre-flight first; evidence captures run in parallel.
- `{T025, T026} → T027`. Web-shell E2E summary indexes the screenshot/GIF artefacts.
- `{T023, T024, T025, T026, T027, T028} → T029`. Feature post reads from the evidence dir.
- `T029 → T030`. PR command requires `media/shipped-post.md` to exist.

### Parallel Opportunities

| Granularity | What can run in parallel |
|-------------|--------------------------|
| Phase 1 internal | T001 ‖ T002 (then T003 → T004 → T005 sequentially) |
| Phase 3 cross-host | The two-task VS Code chain (T009 → T010) ‖ the two-task web-shell chain (T011 → T012). Mark each task `[P]` to show this. |
| Phase 4 cross-host | T015 + T017 (VS Code) ‖ T016 + T018 (web-shell) |
| Phase 6 evidence | T023 ‖ T024 ‖ T025 ‖ T026 ‖ T028 (all write to different files under `evidence/`) |

### Critical Path

T001 → T003 → T004 → T005 → T006 → T007 → T012 → T013 → T014 → T018 → T019 → T020 → T022 → T027 → T029 → T030

(16 sequential steps; everything else parallelises off this path. Down from 13 steps in v1 — the critical path is one step longer because Phase 1 schema regen is now sequential, but the total task count drops from 31 to 30 due to fewer files needing wiring.)

### Independent Test Criteria — recap

- **US1 independent test**: Open a multi-storyboard plot, pick a non-default Storyboard, reload, verify the picked Storyboard is selected. Test file: `apps/web-shell/playwright/tests/active-storyboard-persistence.spec.ts` happy-path scenario (T013) + the VS Code service test (T009).
- **US2 independent test**: Pre-seed the fixture plot with a SystemState feature whose ID is not in the plot; open; verify the panel falls back silently to `getActiveStoryboardDefault()` and the stale entry self-heals on the next open. Test file: same Playwright spec (T019 stale-fallback scenario) + the V-2 + self-heal Vitest assertions (T015, T016).
- **US3 independent test**: Set distinct selections in two FeatureCollections; assert the helpers cannot cross-contaminate. Test file: `shared/components/src/storyboard/__tests__/activeStoryboardSelection.test.ts` US3-named cases (T021).

---

## Implementation Strategy

### Incremental Delivery

The PR is shippable at every checkpoint. Each phase is a complete, verifiable increment:

1. **After Phase 1** — the schema is extended and round-trips pass; both hosts still behave exactly like today (no helpers consume the schema yet). The PR could merge here as a no-op schema bump preparing for the host wiring.
2. **After Phase 2** — the helpers exist and are unit-tested; both hosts still behave exactly like today (no host wiring yet). The PR could merge here as a no-op refactor.
3. **After Phase 3** — happy-path persistence works end-to-end. An analyst on either host can pick a non-default Storyboard, close the plot, reopen it (or hand it off to a colleague), and find the same Storyboard selected. Stale records (Storyboard deleted in another session) would fail awkwardly here, so this is "merge-on-demo-day-only" rather than "merge-to-main".
4. **After Phase 4** — robustness in. Stale records resolve silently and self-heal. The PR is ready for main.
5. **After Phase 5** — multi-plot independence is explicitly tested (it was always implicitly correct, since each plot has its own FeatureCollection).
6. **After Phase 6** — evidence captured, blog post written, PR opened.

### Recommended Order (Single Implementer)

1. T001 ‖ T002 → T003 → T004 → T005 (Phase 1 schema, ~30 min including the regen run).
2. T006 → T007 → T008 (Phase 2 helpers, ~30 min).
3. T009 → T010 (VS Code wiring, ~30 min including locating the plot-edit pipeline call site if not already obvious).
4. T011 → T012 (Web-shell wiring, ~30 min).
5. T013 → T014 (Playwright happy path, ~30 min including fixture).
6. T015 → T017 ‖ T016 → T018 (V-2 + self-heal, ~30 min).
7. T019 → T020 (Stale-fallback E2E, ~20 min).
8. T021 (US3 audit, ~10 min).
9. T022 (Pre-flight, must pass before evidence).
10. T023 ‖ T024 ‖ T025 ‖ T026 ‖ T028 (Evidence in parallel, ~30 min).
11. T027 → T029 (Summary + blog, ~30 min).
12. T030 (PR command).

**Total**: 30 tasks, single-implementer estimate ~4–5 hours of focused work plus review time. (Slightly faster than v1 — the schema regen replaces the conformance suite, the helpers replace two adapter implementations, and the ESLint exception drops.)

### Parallel Team Strategy

With two implementers (one per host):

1. Both: T001 ‖ T002 → T003 → T004 → T005 → T006 → T007 → T008 (Phase 1 + 2 jointly).
2. Implementer A (VS Code): T009 → T010.
3. Implementer B (Web-shell): T011 → T012.
4. Implementer B (still web-shell, since the spec lives in the web-shell tree): T013 → T014.
5. Both: T015 → T017 ‖ T016 → T018 (each implementer adds V-2 to their own host).
6. Implementer B: T019 → T020.
7. Either: T021, then Polish (T022 onwards).

### Risk Notes

- **Risk: locating the plot-edit pipeline call site for `setActiveStoryboard` (T010, T012)** — this is the single most likely "looks done in tests but breaks at runtime" failure mode. Both hosts already use `@debrief/stac-writer` for storyboard CRUD writes (#235, #236, #242) — find the existing call site for `setActiveStoryboard` if it currently writes the plot, OR co-locate the new write next to the existing storyboard CRUD writes in `storyboardEdit.ts`. The Playwright E2E (T013) catches this; do not skip the E2E.
- **Risk: schema regen produces unexpected diff in `generated/`** (T003) — additive LinkML changes should produce a small, focused diff. If the regen produces sweeping changes across files, double-check T001 and T002 didn't accidentally rewrite a `state_type` block or change a non-`SystemStateProperties` slot. Revert and re-apply more carefully.
- **Risk: existing schema fixtures fail T005 round-trip** — additive LinkML changes (new permitted enum value + new optional slot) MUST preserve all existing fixtures. If a fixture fails, the change is not actually additive — investigate (typically: a `required` slot was added by mistake, or a permitted-value list was tightened rather than extended).
- **Risk: VS Code `setActiveStoryboard` isn't currently routed through `@debrief/stac-writer`** — research §3 noted the lifecycle hook for `setActiveStoryboard` exists but didn't deeply audit whether it currently emits a Feature mutation through the plot-edit pipeline. T010 budget includes ~10 minutes for this audit. If `setActiveStoryboard` does NOT currently write the plot (it might only update in-memory state), Path D requires routing the new SystemState write through the storyboard CRUD's existing pipeline — co-locate the call next to `addStoryboard` / `updateScene` in `storyboardEdit.ts` and re-export a helper if needed.
- **Risk: SystemState feature ID regex collision** — the existing schema enforces `^state\.[a-z]+$` on `SystemState.id`. Our chosen ID `state.activestoryboard` (no separator) satisfies the regex. If a contrib extension or older fixture happens to also use that exact ID for some other purpose, the helper's de-dup logic (V-5) handles the collision but emits a non-fatal log warning. We're the first runtime consumer; collision risk is effectively zero.

### What you do NOT need to do (recap from quickstart.md)

- Modify `getActiveStoryboardDefault`. It stays pure.
- Modify the shared `StoryboardPanel` React component. It stays prop-driven.
- Modify `StoryboardFeature` in the LinkML schema. The `is_active` slot path is rejected.
- Add a "pinned" / "clear pin" UI affordance. Spec Out-of-Scope.
- Add a provenance entry on selection change. Spec FR-014 — explicitly verified by T009 assertions (d) and (e).
- Add a feature flag. The behaviour is a strict superset of today (first-open with no SystemState feature === today's behaviour).
- Add an ESLint exception. Path D writes through the existing `@debrief/stac-writer` pipeline; no new direct-storage boundary opens.
- Build an adapter abstraction. The contract surface is the LinkML schema itself.
