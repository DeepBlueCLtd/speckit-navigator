# Research — Active-Storyboard Selection Persistence

**Feature**: #237
**Date**: 2026-05-06 (rewritten 2026-05-07 after `/speckit.review` pivot to Path D)

This document resolves the open implementation questions for spec
#237 before design. Each section follows the *Decision / Rationale /
Alternatives considered* format.

> **Note on history**: An earlier draft of this research adopted a
> per-host adapter strategy (`@debrief/config` for VS Code +
> `localStorage` for web-shell). On `/speckit.review` the user
> directed: *"Plot state should be stored in the plot-file. I'm
> pretty sure we have an existing strategy for storing non-spatial
> 'system' data in the GeoJSON."* The existing strategy is the
> `SystemState` LinkML pattern (defined in
> `shared/schemas/src/linkml/geojson.yaml`, currently unconsumed by
> production code). This rewrite documents Path D — in-plot
> persistence via `SystemState`.

---

## 1. Where does persistence live?

**Decision**: Inside the plot's GeoJSON FeatureCollection, as a
`SystemState` Feature with `kind: SYSTEM`,
`state_type: active_storyboard`, `id: state.activestoryboard`, and
`properties.active_storyboard_id` set to the chosen Storyboard's ID.

**Rationale**:

- The LinkML schema already defines `SystemState` /
  `SystemStateProperties` / `SystemStateTypeEnum` for "non-spatial
  application state" in
  `shared/schemas/src/linkml/geojson.yaml`. The existing permitted
  variants are `temporal`, `spatial`, `selection` — all per-plot,
  shared, lives-inside-the-FeatureCollection state. Active-Storyboard
  selection is the same shape of concern.
- The pattern was schema-defined but had no production consumer at
  the time of writing (verified by grep — only the Python parser
  recognises `kind: SYSTEM`, but no host code reads or writes the
  Feature). #237 becomes the first consumer.
- Storing the selection in the plot file gives **cross-host
  parity for free**: any host that reads the plot reads the
  `SystemState` feature too. No per-host adapter, no sync layer,
  no `@debrief/config` browser backend.
- `@debrief/stac-writer` (from #236 / #242) already writes the
  plot file on every Storyboard / Scene edit. The active-Storyboard
  write rides the same pipeline — no new write infrastructure.

**Alternatives considered**:

- **Per-host adapter (the previous draft)**: rejected on
  `/speckit.review`. Required a new shared interface,
  per-host adapters, an ESLint exception for `localStorage`,
  per-host conformance tests, and would NOT have given
  cross-host parity. Path D is structurally simpler and
  semantically richer.
- **`is_active` boolean slot on `StoryboardFeature` itself**
  (option (a) from the original backlog item): rejected. (a)
  pollutes the data Feature with UI state — analogous to the
  Article IV separation between data and presentation; (b)
  multiple Storyboards could have `is_active: true`
  simultaneously with no schema invariant against it; (c) misses
  the point of the existing `SystemState` pattern, which exists
  exactly to keep "system / UI" state out of data Features.
- **Reuse `state_type: selection` with a discriminator**:
  rejected. The `selection` variant is designed for "selected
  feature IDs" (an array). Overloading it to also mean "active
  storyboard" would muddy semantics and confuse future readers.
  A new variant is the smallest, cleanest change.

---

## 2. How is the selection keyed?

**Decision**: It isn't keyed externally — the `SystemState` feature
lives inside the plot's own FeatureCollection, so per-plot
independence is structural. The single feature identifies the plot's
active Storyboard via the standard ID pattern
(`id: state.activestoryboard`, matching the existing
`^state\.[a-z]+$` regex enforced by the LinkML `SystemState` class).

**Rationale**:

- A plot's FeatureCollection naturally namespaces its own state.
  Two plots have two FeatureCollections; their `SystemState`
  features cannot collide.
- The ID pattern `state.<lowercase>` is already enforced by the
  existing schema (regex `^state\.[a-z]+$` on `SystemState.id`).
  `state.activestoryboard` (no separator) satisfies the regex; using
  `state.active_storyboard` would not. This is a structural
  constraint of the schema as written today, not a decision.
- Single-entry semantics — at most one `SystemState` feature with
  `state_type: active_storyboard` per FeatureCollection — is
  enforced by the helper introduced in this feature, NOT by the
  schema (LinkML cannot easily express "at most one feature with
  a given properties value"). The helper performs upsert-on-write
  and de-dup-on-read.

**Alternatives considered**:

- **Allow multiple entries and let the helper pick the most
  recent**: rejected. Plot files would silently grow over time as
  duplicates accumulate. Helper-enforced single-entry semantics
  on every write is cleaner and prevents the bloat.
- **Use `id: state.activeStoryboard` (camelCase)**: rejected. The
  existing `SystemState.id` regex is `^state\.[a-z]+$` —
  case-sensitive, lowercase-only. We would have to amend the
  regex (a backwards-incompatible schema change for any other
  current consumer) just to accommodate aesthetic preference.
  The lowercased `state.activestoryboard` reads fine.

---

## 3. Where do reads and writes hook in?

**Decision**:

- **VS Code** (`apps/vscode/src/services/storyboardPlayback.ts`):
  - `onPlotOpened(documentUri, plot)` (around line 240): after
    the existing
    `state.activeStoryboardId = active?.properties.id ?? null`
    (line 265 today), call the new helper
    `getActiveStoryboardSelection(plot)` from
    `@debrief/components/storyboard`. If it returns a non-null
    Storyboard ID **and** that ID is present in `plot.features`,
    overwrite `state.activeStoryboardId` with it. Otherwise the
    default-fallback value stands; if the helper returned a stale
    ID, the host queues a self-heal write (Phase 4) through the
    same plot-edit pipeline used by `setActiveStoryboard`.
  - `setActiveStoryboard(documentUri, storyboardId)` (around
    line 360): after the existing
    `state.activeStoryboardId = storyboardId` write, build the
    new/updated `SystemState` feature using the helper
    `setActiveStoryboardSelection(plot, storyboardId)` and emit
    the resulting feature mutation through the same plot-edit
    pipeline that storyboard CRUD already uses.

- **Web-shell** (`apps/web-shell/src/StoryboardPanelMount.tsx`):
  - Replace the bare `useState<string | null>(null)` for
    `activeOverrideId` with an effect that runs on `plot` change,
    calls `getActiveStoryboardSelection(plot)`, validates the
    returned ID is in `plot.features`, and seeds
    `activeOverrideId` accordingly. If the helper returns `null`
    or the ID is stale, leave `activeOverrideId` `null` so the
    existing `getActiveStoryboardDefault(plot)` path takes over;
    queue a self-heal write in the stale case.
  - Update `setActiveOverrideId(storyboardId)` call sites
    (lines 320–325 dropdown handler and line 361 post-create) to
    follow with `setActiveStoryboardSelection(plot, storyboardId)`
    via the host's plot-edit pipeline.

- **No changes** to the shared `StoryboardPanel` component or
  `getActiveStoryboardDefault`. The fallback rule, the dropdown
  UX, the scene-row rendering, and the `onActiveStoryboardChange`
  prop contract all remain identical to #235.

**Rationale**:

- Reads and writes hook into the **same** points as the previous
  draft did (mount-time read + dropdown-handler write). What
  changes is the destination: instead of a per-host adapter, the
  destination is the plot's FeatureCollection via the existing
  edit pipeline.
- The shared helper (in `@debrief/components/storyboard`) keeps
  hosts symmetric: each host calls
  `getActiveStoryboardSelection(plot)` and
  `setActiveStoryboardSelection(plot, id)`; only the
  pipeline-emit step differs (VS Code's
  `storyboardEdit.ts` versus web-shell's edit harness).

**Alternatives considered**:

- **Hook persistence inside `getActiveStoryboardDefault`**:
  rejected (same as previous draft). The default-selection rule
  is pure (input: a plot; output: a Storyboard); a side-effect
  in there would couple the rule to a write path.
- **Push the helper into `useStoryboardEditReducer`**: rejected.
  The reducer is host-symmetric and shouldn't grow a new action
  for what is essentially a one-feature-Mutation. The host wiring
  is the right altitude.

---

## 4. Failure modes and fallbacks

**Decision**:

- **Read failure (parse / scan error on the SystemState
  feature)** → silent fallback to
  `getActiveStoryboardDefault()`. One non-fatal log entry.
- **Stale recorded ID (Storyboard deleted in another session)**
  → fallback to default; the next write opportunity (open-time
  self-heal or analyst override) overwrites the stale feature.
- **Write failure (plot save fails through
  `@debrief/stac-writer`)** → inherits the existing plot-save
  failure UX from #236 / #242. Selection is held in-memory for
  the current panel session; next open reverts to the previously
  saved value (or default).

**Rationale**:

- Spec FR-006 / FR-007 / FR-011 / FR-012 / SC-003 / SC-006 all
  require silent degradation. The user must not see the
  persistence layer as a visible surface unless it actively does
  the right thing.
- The plot-save failure UX is not invented here; it's reused
  from `@debrief/stac-writer`. This is the right shape — the
  selection write IS a plot edit, and plot-save failures already
  surface a banner/toast in both hosts. We don't need a separate
  selection-failure UX.

**Alternatives considered**:

- **Surface a toast on selection-write failure**: rejected. A
  user whose plot save is failing already sees the existing
  failure UX; adding a second toast for the selection
  specifically is noise.
- **Fail closed (refuse to render the panel) on read failure**:
  rejected — directly contradicts FR-011 ("MUST NOT prevent the
  panel from rendering").

---

## 5. Schema impact

**Decision**: Two **additive, non-breaking** edits to LinkML:

1. `shared/schemas/src/linkml/common.yaml` — add
   `active_storyboard` to `SystemStateTypeEnum`'s permitted
   values (alongside `temporal`, `spatial`, `selection`).
2. `shared/schemas/src/linkml/geojson.yaml` — add an optional
   `active_storyboard_id: string` slot on
   `SystemStateProperties`.

Both changes are strictly additive — existing fixtures still
validate, existing parsers continue to accept all currently-valid
inputs.

**Rationale**:

- **Article II.1**: LinkML is the single source of truth; schema
  changes are the right and only way to introduce new persisted
  fields.
- **Article II.2**: derived schema adherence tests are mandatory.
  This change runs the existing schema round-trip / golden
  fixture test infrastructure, plus adds one new fixture (a
  plot with the new `SystemState` feature) so the new field is
  itself round-trip tested.
- The `SystemState` feature pattern was *defined* in the schema
  but had no production consumer. Adding `active_storyboard` is
  essentially "turning on" this latent capability — and doing so
  correctly tests the round-trip story for the entire pattern,
  which has knock-on value for any future consumer of `temporal`
  / `spatial` / `selection` `SystemState` features.

**Alternatives considered**:

- **Squat on `state_type: selection` and pack the storyboard ID
  into `selected_ids[0]`**: rejected. Would conflate two
  unrelated concerns (feature selection ≠ active-storyboard
  pick) and obstruct any future use of `selection` for its
  intended purpose.
- **No schema change; serialise the selection inside an existing
  feature's `description` or arbitrary `properties` field**:
  rejected — un-typed, un-validated, un-discoverable, can't
  round-trip.

---

## 6. Test strategy

**Decision**:

- **Schema round-trip** (Python ↔ JSON ↔ TypeScript) for a new
  fixture containing the `SystemState` feature with
  `state_type: active_storyboard`. Plugs into the existing
  schema test infrastructure.
- **Helper unit tests** (Vitest) for
  `getActiveStoryboardSelection(plot)` and
  `setActiveStoryboardSelection(plot, id)` in
  `@debrief/components/storyboard`: cover empty plot, no
  matching feature, valid feature, stale feature, malformed
  feature, single-entry upsert (writing twice produces one
  feature, not two), null clears the entry.
- **Type-guard unit tests** for
  `isActiveStoryboardSelection(feature)` mirroring the existing
  `isStoryboardFeature` / `isSceneFeature` test pattern.
- **Service test** (Vitest) for `storyboardPlayback.ts`'s
  `onPlotOpened` and `setActiveStoryboard` against an in-memory
  fake plot: assert mount-time read seeds the active selection,
  override writes the `SystemState` feature, stale fallback
  self-heals, no provenance entry is added (FR-014).
- **Component test** (Vitest + RTL) for `StoryboardPanelMount.tsx`
  covering the same three behaviours via a fake plot-edit pipeline.
- **Playwright E2E** in `apps/web-shell/playwright/tests/`
  covering US1's full open → switch → reload → still-switched
  flow against a multi-storyboard fixture plot, plus US2's
  stale-fallback by pre-seeding the fixture plot with a
  `SystemState` feature whose `active_storyboard_id` does not
  exist in the plot.

**Rationale**:

- Acceptance scenarios in spec.md US1 / US2 / US3 map 1:1 to
  the above tests (see quickstart.md §Testing for the explicit
  mapping).
- Schema round-trip catches drift in the LinkML → derived
  artefacts pipeline; helper unit tests catch logic bugs in the
  Feature mutation; service / component tests catch wiring
  bugs; Playwright catches host-integration bugs.
- Per Article XII / preview-app deployment, the Playwright
  spec also produces the screenshots / GIF for the eventual
  blog post, satisfying media coverage at zero extra cost.

**Alternatives considered**:

- **VS Code chrome-level Webview Playwright test**: rejected.
  The user-visible "reopen-on-pinned" behaviour is symmetric
  across hosts and the web-shell run already exercises the
  shared `StoryboardPanel`. A parallel openvscode-server run
  would add ~10 minutes per CI build with no new coverage.
- **Skip schema round-trip — rely on TypeScript type
  inference**: rejected. Article II.2 mandates derived schema
  adherence tests on every schema change. Skipping is a
  Constitution violation.

---

## 7. Architectural Boundaries (Article IV)

**Decision**: No ESLint exception is required. Path D writes
through the existing `@debrief/stac-writer` plot-edit pipeline,
which is already the "unified writer abstraction" Article IV.4
mandates. The new helper produces a Feature mutation (a pure
function over the FeatureCollection); the host emits that
mutation through the existing pipeline; no new direct-storage
boundary is opened.

**Rationale**:

- The previous draft needed an ESLint exception because it had
  the web-shell touching `localStorage` directly. Path D has
  no equivalent — every write goes through the plot-edit
  pipeline that already passes Article IV.4.
- Compared to the previous draft: **one fewer exception entry,
  one fewer review surface, one fewer file in the
  no-restricted-globals allowlist**.

**Alternatives considered**:

- N/A — there is no architectural constraint to negotiate.

---

## 8. Cross-host migration / backwards compatibility

**Decision**: No migration is performed and none is required.

- **First-open of any pre-existing plot**: the FeatureCollection
  contains no `SystemState` feature with
  `state_type: active_storyboard`; the helper returns `null`;
  the panel falls back to `getActiveStoryboardDefault()` exactly
  as today.
- **Older host versions opening a new-format plot file**: the
  schema change is additive (new permitted enum value, new
  optional slot). An older parser sees an unknown
  `state_type` value (graceful — the slot is a string in
  older generated types unless the parser uses a strict enum
  validator), or, more conservatively, rejects the feature.
  Either outcome is acceptable: the plot's *Storyboard* and
  *Scene* features (the data) are untouched, so the older host
  can still open and edit the plot. The pinned selection won't
  carry across to the older host — also acceptable, the older
  host falls back to default.
- **New host opening an older-format plot file**: no
  `SystemState` feature with the new variant exists; default
  fallback fires; first override starts the per-plot record.
  No migration tooling needed.

**Rationale**:

- The lightest-possible upgrade path. First open of any
  familiar plot is identical to today; the first override
  starts the new behaviour. Zero onboarding, zero migration
  tooling, zero "your plot has been migrated" notification.
- Mixed-version interop is naturally graceful because the
  schema change is purely additive on a previously-unconsumed
  pattern.

**Alternatives considered**:

- **Migration script that pre-seeds every plot's
  `SystemState` feature with `getActiveStoryboardDefault()`**:
  rejected. Pre-seeding would change the user-visible default
  (`getActiveStoryboardDefault()` is computed fresh on every
  open today), and the value of pre-seeding is zero — the
  analyst wouldn't notice any difference.

---

## 9. Single-entry invariant

**Decision**: At most one `SystemState` feature with
`state_type: active_storyboard` per FeatureCollection. The helper
enforces this on every write via upsert (find-and-replace) rather
than append.

**Rationale**:

- Two entries are semantically nonsensical (which one is "the
  active selection"?) and would silently grow the FeatureCollection
  over time on every override.
- Helper-side enforcement is the right altitude — the LinkML
  schema cannot easily express "at most one feature with a given
  properties value", but the helper that produces and consumes
  these features can.
- On read, the helper de-dups defensively (returns the first
  matching feature if more than one is somehow present) and
  emits a non-fatal log warning.

**Alternatives considered**:

- **Allow many entries; pick the most recent on read**:
  rejected (see §2). Silent bloat over time.
- **Schema-level uniqueness constraint**: rejected — LinkML
  cannot express "exactly one feature in the array with a
  given properties value". A custom Pydantic validator could
  enforce it post-parse, but the cost (per-parse iteration
  through every feature) outweighs the benefit (helper-side
  enforcement is sufficient).
