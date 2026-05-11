# Implementation Plan: Active-Storyboard Selection Persistence

**Branch**: `237-active-storyboard-persistence` (work being delivered on `claude/speckit-specify-237-HIO9k`)
**Date**: 2026-05-06 (rewritten 2026-05-07 after `/speckit.review` pivot to Path D)
**Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/237-active-storyboard-persistence/spec.md`

## Summary

Persist the analyst's active-Storyboard pick **inside the plot file
itself**, as a `SystemState` GeoJSON Feature in the FeatureCollection.
Closing and reopening a plot — by any analyst, on any host, on any
machine that has the plot file — restores the most-recently-pinned
Storyboard instead of falling back to `getActiveStoryboardDefault()`.

- **LinkML extends, additively**:
  `SystemStateTypeEnum` gains `active_storyboard`;
  `SystemStateProperties` gains an optional `active_storyboard_id`
  string slot. Both edits are non-breaking; existing plot fixtures
  still validate.
- **One pair of helpers in `@debrief/components/storyboard`** —
  `getActiveStoryboardSelection(plot)` /
  `setActiveStoryboardSelection(plot, id)` — produce / consume the
  `SystemState` feature as a pure FeatureCollection transformation.
  A new `isActiveStoryboardSelection` type-guard mirrors
  `isStoryboardFeature` / `isSceneFeature`.
- **Host wiring** in `apps/vscode/src/services/storyboardPlayback.ts`
  and `apps/web-shell/src/StoryboardPanelMount.tsx` — read on mount
  via the helper; write on every dropdown override through the
  existing plot-edit pipeline (`@debrief/stac-writer` from #236 /
  #242, identical to how Storyboard/Scene CRUD writes are emitted).
- **No adapter abstraction, no per-host backend, no ESLint
  exception**. Path D writes through the existing unified writer
  abstraction (Article IV.4 satisfied by reuse).
- **Per-plot SHARED semantics**: any analyst opening the plot lands
  on the most-recently-pinned Storyboard. Per-user-within-shared-plot
  view memory is explicitly out of scope and tracked as a separate
  backlog item.
- Read failures fall back to `getActiveStoryboardDefault()`. Stale
  IDs (Storyboard deleted in another session) self-heal on the next
  open via an open-time write through the same pipeline. Plot-save
  failures inherit the existing `@debrief/stac-writer` failure UX.

## Technical Context

**Language/Version**: Python 3.11 (LinkML schema source + Pydantic-generated models); TypeScript 5.x strict (helpers + host wiring). No new languages.
**Primary Dependencies**: `LinkML >= 1.7.0` + `gen-pydantic` / `gen-json-schema` / `gen-typescript` (existing — used to regenerate the derived schema artefacts on schema change); `@debrief/components` (existing — `StoryboardPanel`, `getActiveStoryboardDefault`, `isStoryboardFeature`); `@debrief/stac-writer` (existing — plot-edit pipeline used for all Feature mutations across both hosts since #236 / #242). **No new runtime dependencies.**
**Storage**: The plot's GeoJSON FeatureCollection (the same file `@debrief/stac-writer` already writes for every Storyboard / Scene CRUD edit). Selection is one Feature in that collection. No per-host store, no `localStorage`, no `@debrief/config`. The plot file IS the cross-host sync layer.
**Testing**: Existing schema round-trip / golden-fixture suite (one new fixture added — covers the new `SystemState` variant); Vitest unit tests for the three new helpers; service-level test for `storyboardPlayback.ts`'s mount + write paths against an in-memory fake plot; component test for `StoryboardPanelMount.tsx` against a fake plot-edit pipeline; one Playwright E2E covering US1 happy-path + US2 stale fallback (mirrors existing storyboard E2E patterns).
**Target Platform**: VS Code extension host (Node) and web-shell browser PWA. Both already wired to `@debrief/stac-writer`. Feature must function offline — schema is local, plot files are local, no network involved.
**Project Type**: Web application — the existing monorepo split (VS Code extension + web-shell + shared components + LinkML schema package).
**Performance Goals**: Mount-time read is an in-memory walk of `plot.features` (already loaded by the parser). Write is a single Feature upsert routed through the existing plot-edit pipeline — no new I/O characteristic versus today's storyboard CRUD writes. SC-003 ("fallback completes within the same render cycle") trivially satisfied.
**Constraints**: Schema change MUST be additive (existing fixtures pass without modification); helpers MUST be pure (no I/O — the host owns I/O); no new ESLint exceptions; no `any`; the shared `StoryboardPanel` interface MUST NOT change (the persistence wiring is host-private); plot-edit writes MUST go through `@debrief/stac-writer`, not direct file/Storage calls.
**Scale/Scope**: One LinkML enum addition + one optional slot addition; three helpers + their unit tests; two host-wiring edits; one Playwright spec; one schema fixture. No `localStorage` adapter, no `@debrief/config` adapter, no shared interface, no ESLint allowlist edit, no conformance suite — all of which the previous draft required.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Article | Compliance |
|---------|-----------|
| I. Defence-Grade Reliability | ✅ Offline by default — the plot file is local; no network. No silent failures: read errors fall back to `getActiveStoryboardDefault()` and at most write a single non-fatal log entry (FR-011). Write errors inherit the existing `@debrief/stac-writer` failure UX (FR-012). Reproducibility unaffected — the plot file is the single source of truth. |
| II. Schema Integrity | ✅ **Additive LinkML change.** `SystemStateTypeEnum` gains one permitted value; `SystemStateProperties` gains one optional slot. Existing schema round-trip / golden-fixture suite passes without modification. One new fixture exercises the new variant. Article II.1 (LinkML as single source of truth) honoured; Article II.2 (derived-schema adherence tests mandatory on every schema change) honoured by the new fixture + existing infrastructure. |
| III. Data Sovereignty | ✅ Active-Storyboard selection is a state-pin act, NOT a content edit. Per FR-014 it does NOT enter the plot's `provenance` chain (so plot diffs stay noise-free, audit logs remain truthful, and pin history doesn't leak into plot-level lineage). The `SystemState` feature has its own optional `provenance` slot which this feature leaves empty. Source files preserved; data stays local; no telemetry. |
| IV. Architectural Boundaries | ✅ **No new direct-storage boundary opened.** All writes route through the existing `@debrief/stac-writer` plot-edit pipeline (already the unified writer abstraction Article IV.4 mandates, in use since #236 / #242). The previous draft's ESLint exception is no longer required and not introduced. |
| V. Extensibility | ✅ N/A — feature is internal plumbing on the existing `SystemState` pattern. The schema extension itself is generic enough that future "system state" variants can slot in alongside `active_storyboard` without further schema gymnastics. |
| VI. Testing | ✅ Schema round-trip via the existing infrastructure + one new fixture; helper unit tests; service- and component-level wiring tests; one Playwright E2E covering the user-visible workflow. |
| VII. Test-Driven AI Collaboration | ✅ Acceptance scenarios in spec.md US1/US2/US3 are the executable spec; this plan ties each scenario to a specific test file and assertion (see quickstart.md §Testing). |
| VIII. Documentation | ✅ Spec.md, plan, research, data-model, quickstart all rewritten on the Path D pivot. The pivot itself is recorded inline (each artefact has a "rewritten 2026-05-07 after `/speckit.review` pivot" note). #235 research §8 cross-reference unchanged ("active-Storyboard selection is now persisted per-plot via #237"). |
| IX. Dependencies | ✅ **Zero new runtime dependencies.** LinkML, `@debrief/components`, `@debrief/stac-writer`, Vitest, Playwright — all already in use. |
| X. Security | ✅ No secrets stored. Storyboard IDs are not classified data. The plot file is the existing trust boundary; nothing new is exposed. |
| XI. Internationalisation | ✅ N/A — feature surfaces no new user-facing strings. |
| XII. Community Engagement | ✅ Public PR, public review, includes a feature blog post (Phase 6 cached opener already exists from the previous draft and remains valid for Path D — the user-visible workflow is identical). |
| XIII. Contribution Standards | ✅ Atomic commits, PR review, CI enforcement. |
| XIV. Pre-Release Freedom | ✅ Pre-v4.0.0; this is an additive schema extension with a documented user-visible upgrade path (silent restore on plot open). Older host versions opening a new-format plot file see the new feature gracefully ignored (additive schema, optional slot). |
| XV. Strict Type Safety | ✅ All new code in TypeScript strict mode. The helpers and type-guards are explicitly typed; the new schema slot is statically typed via gen-typescript. No `any`. The `SystemState` parse boundary is governed by Pydantic / Zod-equivalent generated types. |

**Result**: PASS. **No Complexity Tracking entries** (the previous draft's
ESLint exception is dropped — Path D doesn't need it). No ERROR
conditions.

## Project Structure

### Documentation (this feature)

```text
specs/237-active-storyboard-persistence/
├── plan.md              # This file
├── spec.md              # Feature specification (rewritten for Path D)
├── research.md          # Phase 0 output (rewritten for Path D)
├── data-model.md        # Phase 1 output (rewritten for Path D)
├── quickstart.md        # Phase 1 output (rewritten for Path D)
├── checklists/
│   └── requirements.md  # Already written by /speckit.specify (still valid — checklist semantics survive the pivot)
├── evidence/
│   └── opening-context.md  # Phase 6 output (cached blog opener — already created, still valid since the user-visible flow is unchanged)
└── tasks.md             # Created by /speckit.tasks (rewritten for Path D)
```

> **Removed**: `contracts/active-storyboard-selection-store.ts` from
> the previous draft. Path D does not have an adapter abstraction;
> the contract surface is the LinkML schema itself, which is the
> existing project pattern for cross-language data contracts.

### Source Code (repository root)

```text
shared/schemas/src/linkml/
├── common.yaml                                    # MODIFIED — add `active_storyboard` to
│                                                    SystemStateTypeEnum permitted values.
└── geojson.yaml                                   # MODIFIED — add optional
                                                     `active_storyboard_id: string` to
                                                     SystemStateProperties.

shared/schemas/src/generated/                      # AUTO-REGENERATED by gen-pydantic /
                                                     gen-json-schema / gen-typescript on
                                                     the LinkML edits above. Not hand-edited.

shared/schemas/src/fixtures/                       # MODIFIED — add one new fixture covering
                                                     a plot with the new `SystemState`
                                                     feature; existing fixtures still pass
                                                     without modification (additive change).

shared/components/src/storyboard/
├── activeStoryboardSelection.ts                   # NEW — pure helpers:
│                                                    `isActiveStoryboardSelection(f)`,
│                                                    `getActiveStoryboardSelection(plot)`,
│                                                    `setActiveStoryboardSelection(plot, id)`.
│                                                    No I/O, no React, no host coupling.
│                                                    Re-exported via the storyboard barrel.
├── index.ts                                       # MODIFIED — re-export the three helpers.
└── __tests__/
    └── activeStoryboardSelection.test.ts          # NEW — Vitest unit tests for all three
                                                     helpers (V-1 through V-5 invariants).

apps/vscode/src/services/
├── storyboardPlayback.ts                          # MODIFIED — onPlotOpened reads via
│                                                    getActiveStoryboardSelection; if stale,
│                                                    self-heal write through plot-edit
│                                                    pipeline. setActiveStoryboard writes
│                                                    via setActiveStoryboardSelection +
│                                                    plot-edit pipeline.
└── __tests__/
    └── storyboardPlayback.persistence.test.ts     # NEW — service-level wiring test against
                                                     in-memory fake plot + fake edit pipeline.

apps/web-shell/src/
├── StoryboardPanelMount.tsx                       # MODIFIED — replace bare useState with a
│                                                    plot-driven effect that reads via the
│                                                    helper; in onActiveStoryboardChange,
│                                                    write via the helper + plot-edit
│                                                    pipeline.
└── __tests__/
    └── StoryboardPanelMount.persistence.test.tsx  # NEW — RTL component test against fake
                                                     plot + fake edit pipeline.

apps/web-shell/playwright/tests/
└── active-storyboard-persistence.spec.ts          # NEW — single E2E covering US1 happy
                                                     path + US2 stale fallback.

# REMOVED versus the previous draft:
#   - shared/components/src/storyboard/activeStoryboardSelectionStore.ts (adapter interface)
#   - apps/vscode/src/services/activeStoryboardSelectionStoreVscode.ts
#   - apps/web-shell/src/services/activeStoryboardSelectionStoreWebShell.ts
#   - shared/eslint-rules/no-direct-persistence-in-frontend.cjs MODIFIED entry
#   - The conformance test suite (no longer two adapter implementations to conform)
```

**Structure Decision**: The split mirrors the existing storyboard
helper pattern (`isStoryboardFeature` / `isSceneFeature` /
`getActiveStoryboardDefault` all live together in
`shared/components/src/storyboard/`). The helpers are pure; the host
mount layers own I/O via the existing plot-edit pipeline. This (a)
keeps the shared `StoryboardPanel` component free of host-specific
persistence assumptions, (b) reuses the unified writer abstraction
that Article IV.4 already mandates and #236 / #242 already deliver,
and (c) puts the new persistence concept in the same file family as
the type-guards and selection helpers it sits alongside.

## Media Components

None — backend/infrastructure feature. The user-visible UI from #235
(side-rail header dropdown) is byte-for-byte unchanged. No new
component, no new visual state, no new Storybook story is added by
this feature. Article-XII community engagement is honoured via the
feature blog post (Phase 6 cached opener) and the standard preview-app
deployment, neither of which require a Storybook bundle.

## Storybook E2E Testing

None — no interactive UI components added. The existing
`StoryboardPanel.stories.tsx` and `StoryboardPlayback.stories.tsx`
remain authoritative for the panel's visual behaviour, and they
continue to receive `activeStoryboardId` as a prop, identical to
today.

## Web-Shell E2E Testing

> **⚠️ PLAYWRIGHT WORKS IN CLOUD SESSIONS** — `@sparticuz/chromium` covers Linux Chromium for cloud + CI. Local desktop uses `pnpm exec playwright install chromium`. See `docs/project_notes/playwright-installation-research.md`.

| Workflow | Panels/Components Involved | Key Selectors | Interactions |
|----------|---------------------------|---------------|--------------|
| Active-Storyboard selection persists across plot reload | Catalog picker → MapView → Storyboard side rail (header dropdown + scene list) | `[data-testid="catalog-item-row"]`, `[data-testid="storyboard-active-name"]`, `[data-testid="storyboard-dropdown"]`, `[data-testid="storyboard-option"]`, `[data-testid="storyboard-scene-row"]` | Open plot (≥2 storyboards); read default selection; pick a non-default storyboard from dropdown; reload page; assert dropdown still on the picked storyboard and scene list reflects it. Fixture plot is regenerated through the standard write pipeline so the new `SystemState` feature is naturally produced. |
| Stale-selection fallback (US2) | Same as above, with the fixture plot's FeatureCollection pre-seeded with a `SystemState` feature whose `active_storyboard_id` is not in the plot | Same selectors | Load the pre-seeded fixture plot; assert the panel shows `getActiveStoryboardDefault()`'s pick and renders without an error banner; reload once more; assert the `SystemState` feature now points at the default Storyboard's ID (self-heal verified by reading the persisted plot via the existing `@debrief/stac-writer` test harness). |

**Testing Strategy**:
- [x] Workflow runs end-to-end in the web-shell
- [x] Page objects in `apps/web-shell/playwright/pages/` extended for the storyboard side-rail selectors (reuse `AnalysisPage` rather than introducing a new page object)
- [x] Screenshots and/or interaction GIF written **directly** into `specs/237-active-storyboard-persistence/evidence/screenshots/` from the spec file (mirroring `apps/web-shell/playwright/tests/properties-screenshots.spec.ts` path-resolution pattern)

**Test File Location**: `apps/web-shell/playwright/tests/active-storyboard-persistence.spec.ts`

**Run Commands**:
- Cloud: `cd apps/web-shell && node run-playwright.mjs active-storyboard-persistence`
- Local: `pnpm --filter @debrief/web-shell test active-storyboard-persistence`

**Optional — chrome-level VS Code Webview tests**:
None for this feature. The VS Code path is exercised by Vitest service tests against `storyboardPlayback.ts`; the user-visible "reopen-on-pinned" behaviour is symmetric with the web-shell E2E and a parallel openvscode-server run would add cost without coverage value.

## Complexity Tracking

*No entries.* Path D introduces no Article-IV.4 violation, no
ESLint exception, and no architectural carve-out. The previous
draft's `localStorage` exception is dropped.
