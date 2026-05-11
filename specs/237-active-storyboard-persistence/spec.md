# Feature Specification: Active-Storyboard Selection Persistence

**Feature Branch**: `237-active-storyboard-persistence`
**Created**: 2026-05-06 (rewritten 2026-05-07 after `/speckit.review` pivot to Path D)
**Status**: Draft — ready for quality-checklist validation
**Parent Epic**: #024 Storyboarding Briefings — [idea doc](../../docs/ideas/017-storyboarding-briefings.md)
**Related Specs**: #215 (storyboarding schema + CRUD core), #217 (panel + playback), #235 (storyboard capture & maintenance UX — the spec this follow-up amends)
**Backlog Item**: [#237](../../BACKLOG.md) — *Active-Storyboard selection persistence*
**Input**: Persist the analyst's chosen active Storyboard for a plot so closing and reopening it reopens on the same Storyboard, instead of always falling back to `getActiveStoryboardDefault()` (the most-recently-modified Storyboard).

## Summary

Today, opening a plot that contains multiple Storyboards always lands
the analyst on the **most-recently-modified Storyboard** — the
`getActiveStoryboardDefault()` rule introduced in #215 and adopted by
both hosts. The analyst can override the selection from the side-rail
header dropdown introduced in #235, but that override is held only in
React component state and is **lost as soon as the plot is closed and
reopened**. This was an intentional ephemeral-by-design choice in
#235's research §8, deferred with the note "may be revisited if
analysts complain about losing selection across sessions."

This spec acts on that deferral. After this feature ships, an analyst
working a multi-storyboard plot (commander's view, ASW evidence,
training debrief) can pick "Commander's view" once, close the plot,
walk away, reopen it the next day, and find "Commander's view" still
selected — without re-navigating the dropdown.

The persistence is **stored inside the plot's GeoJSON FeatureCollection**
as a `SystemState` Feature (the existing LinkML pattern at
`shared/schemas/src/linkml/geojson.yaml`'s `SystemState` /
`SystemStateProperties` classes — defined for non-spatial application
state, currently used for `temporal`, `spatial`, and `selection` state
variants). This feature adds one new permitted variant —
`active_storyboard` — and one optional field —
`active_storyboard_id` — to that schema. The active-Storyboard
selection becomes the first runtime consumer of the `SystemState`
pattern.

Because the selection lives in the plot file itself, the persistence
is **per-plot, shared across analysts**: any analyst who opens the
plot lands on the most-recently-pinned Storyboard (regardless of who
pinned it). This matches the existing per-plot semantics of all other
`SystemState` variants and is deliberately preferred over per-user
keying — collaborative review (a commander resuming the briefing
officer's last view, a multi-analyst exercise debrief) is a
first-class case for Debrief, and "what was the last analyst looking
at?" is the answer the panel should restore. Per-user-within-shared-plot
view memory is explicitly out of scope and tracked as a follow-up
backlog item; if it becomes a real requirement, it warrants its own
user-identity model.

The default-selection rule (`getActiveStoryboardDefault()`) is **not
removed**. It remains the fallback for any plot that has never had a
Storyboard pinned, and for any persisted selection whose recorded ID
no longer corresponds to a Storyboard present in the plot (e.g. the
remembered Storyboard was deleted in another session). The dropdown
UI from #235 is unchanged; the only user-visible change is that the
right Storyboard is already selected on plot open.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Reopened plot lands on the last-pinned Storyboard (Priority: P1)

An analyst is working a multi-storyboard plot ("Exercise Trident
2026"). The plot has three Storyboards: *Commander's view*, *ASW
evidence*, and *Training debrief*. The Training debrief was the
most-recently-modified Storyboard, so the host opens the plot on
*Training debrief* by default, but the analyst is preparing the
commander's brief and switches the side-rail dropdown to *Commander's
view*. They scrub through Scenes, take a phone call, close the plot,
and shut down for the day. Next morning, they (or any colleague who
opens the plot) finds the panel **already on *Commander's view*** —
no re-navigation of the dropdown, no mental check that they're on the
right Storyboard.

**Why this priority**: This is the entire feature. Multi-storyboard
plots are a first-class case (per #235 P2: "most analysts on most
plots will work with a single storyboard, but multi-storyboard plots
are a first-class supported case"). Without persistence, every reopen
is a context-switch tax; with it, the panel matches where the last
analyst left off. Everything else in this spec is robustness around
this core behaviour.

**Independent Test**: Open a plot with ≥2 Storyboards in either host;
the default selection lands on Storyboard X (per the
most-recently-modified rule). Switch via the dropdown to Storyboard Y.
Close the plot. Reopen it. Verify the panel header shows Y selected
and the Scene list reflects Y's Scenes (not X's). Repeat the
close/reopen cycle a second time without further interaction; Y must
still be selected.

**Acceptance Scenarios**:

1. **Given** a plot with Storyboards `A` (most-recently-modified) and
   `B`, opened in either host with `B` selected via the dropdown,
   **When** the plot is closed and reopened (same analyst or another),
   **Then** the side-rail header shows `B` as the active Storyboard
   and the Scene list contains only `B`'s Scenes.
2. **Given** a plot that has never had a Storyboard pinned (no
   `SystemState` feature with `state_type: active_storyboard` exists
   in the FeatureCollection), **When** any analyst opens it,
   **Then** the active Storyboard is `getActiveStoryboardDefault()` —
   identical to today's behaviour. The persistence layer adds no
   selection where none was made.
3. **Given** a plot the first analyst pinned to Storyboard `B`,
   **When** a second analyst on a different workstation opens the
   same plot file, **Then** the second analyst's panel is also on
   `B` (per-plot SHARED — the `SystemState` feature is part of the
   plot file). If the second analyst then re-pins to `C`, the next
   open by either analyst lands on `C` (last-writer-wins, matching
   the existing concurrency story for plot edits in #235 research §9).

---

### User Story 2 — Robust fallback when the remembered Storyboard is gone (Priority: P2)

The analyst pinned plot "Exercise Trident 2026" to *Commander's view*
yesterday. Overnight, a colleague reopened the plot, deleted
*Commander's view* (it was a draft), and saved. This morning the
analyst reopens the plot. The recorded `active_storyboard_id` no
longer matches any Storyboard in the plot, so instead of an empty
rail with a "Storyboard not found" error, the panel **falls back to
`getActiveStoryboardDefault()`** — the most-recently-modified
remaining Storyboard — and the stale `SystemState` feature is updated
or removed so the next open lands cleanly.

**Why this priority**: A persistence layer that breaks the panel when
the underlying entity is gone is worse than no persistence at all.
This story makes the feature safe to ship; without it, a single
delete-in-another-session can wedge the analyst's panel.

**Independent Test**: Pin a plot to Storyboard `B`. From a second
session, delete `B` and save. From the first session, open the plot.
Verify the panel falls back to `getActiveStoryboardDefault()` (the
most-recently-modified surviving Storyboard) and shows no error
banner. Close and reopen the plot a second time; the persisted
`SystemState` feature now points to `getActiveStoryboardDefault()`'s
pick (or, if the analyst overrode it after fallback, that new pick) —
never the deleted `B`.

**Acceptance Scenarios**:

1. **Given** a plot with a `SystemState` feature recording
   `active_storyboard_id: B` and a plot in which `B` no longer
   exists, **When** the analyst opens the plot,
   **Then** the active Storyboard is the
   `getActiveStoryboardDefault()` pick over the remaining Storyboards
   and no error or warning is surfaced to the user about the missing
   selection.
2. **Given** the situation above, **When** the analyst takes any
   subsequent action that records a selection (overrides via dropdown
   or interacts with the now-active Storyboard's Scenes long enough
   for the host to write through),
   **Then** the stale `B` value is overwritten with the current
   selection in the `SystemState` feature, and the plot file is
   re-saved through the existing edit pipeline.
3. **Given** a plot that has zero Storyboards remaining (all
   deleted), **When** the analyst opens it,
   **Then** the panel shows the existing #235 "Empty State (no
   Storyboards on plot)" UX unchanged; no persistence-specific error
   appears, and any pre-existing `SystemState` feature with
   `state_type: active_storyboard` is treated as inert (the host
   reads it, finds no storyboard matches, and falls through to the
   empty state).

---

### User Story 3 — Independent persistence across plots (Priority: P3)

Two plots — "Exercise Trident 2026" pinned to *Commander's view* and
"Exercise Aegis 2025" pinned to *ASW evidence* — are opened in turn
throughout the morning. At no point does opening one plot reset the
other plot's pinned selection, and at no point does the selection
from one plot "contaminate" the other.

**Why this priority**: Per-plot keying is a correctness guarantee, not
a feature on its own. With Path D it falls out for free — each
plot's `SystemState` feature lives in its own FeatureCollection — but
it's worth listing as an acceptance story because it's how a
reasonable user could see the system fail ("everything keeps snapping
back to ASW evidence"). Including it as P3 makes it an explicit,
independently-testable behaviour rather than an implicit assumption.

**Independent Test**: Pin plot `P1` to Storyboard `B1` and plot `P2`
to Storyboard `B2`. In any open/close order across the two plots,
each plot must reopen on its own pinned selection. Pinning a new
selection on `P1` must not change `P2`'s selection.

**Acceptance Scenarios**:

1. **Given** plot `P1` pinned to `B1` and plot `P2` pinned to `B2`,
   **When** the analyst opens `P1`, then closes it and opens `P2`,
   **Then** `P2` opens on `B2` (not `B1`).
2. **Given** the situation above, **When** the analyst then
   re-pins `P1` to `B1'`, **Then** `P2`'s `SystemState` feature is
   unchanged (different FeatureCollection — the helpers cannot
   accidentally cross plots).
3. **Given** two plots that each contain a Storyboard with the
   same `name` but different IDs (e.g. both have a Storyboard called
   "Commander's view"), **When** the analyst pins each plot
   independently, **Then** each plot's `SystemState` feature records
   its own Storyboard ID — pinning one plot does not change the
   other even if the names overlap.

---

### Edge Cases

- **First-ever open / no SystemState feature**: A plot that has
  never had a Storyboard pinned has no `SystemState` feature with
  `state_type: active_storyboard` in its FeatureCollection. The
  panel shows `getActiveStoryboardDefault()`. The feature must not
  require a one-time "migration" or onboarding step.
- **Selection cleared back to default**: The dropdown does not need a
  "clear my override" affordance. If the analyst wants to undo a
  pinned selection, they can pick the default Storyboard explicitly
  from the dropdown, and that pick is then persisted as the current
  selection.
- **Plot has exactly one Storyboard**: The dropdown is hidden / inert
  per #235. Persistence is still recorded for forward compatibility
  (so that adding a second Storyboard later doesn't force the analyst
  to re-pin), but no behaviour changes versus today.
- **Plot file moved or copied**: Because the `SystemState` feature
  travels with the plot, moving a plot file to a new location, or
  copying it to another machine, also moves its pinned selection.
  This is correct and desirable per Path D's per-plot semantics.
- **Concurrent edits from two sessions**: If two analysts open the
  same plot file simultaneously and pin different Storyboards, the
  last write to the plot file wins for the next open. This matches
  the existing last-writer-wins concurrency story for plot edits
  (#235 research §9), and is the same semantic as any other CRUD
  edit on the plot.
- **SystemState feature corrupted or malformed**: If a contrib
  extension or manual edit produces a `SystemState` feature whose
  `active_storyboard_id` is invalid (wrong type, references a
  non-existent Storyboard), schema validation flags it on parse;
  the panel falls back to `getActiveStoryboardDefault()` per US2's
  stale-fallback rule.
- **Plot save fails after the analyst pins a selection**: If the
  underlying plot-edit pipeline (`@debrief/stac-writer` from #236 /
  #242) reports a save failure, the analyst sees the existing save
  failure UX from those features (toast/banner). This feature does
  not invent a separate failure mode for selection persistence — the
  selection write IS the plot save.

## Requirements *(mandatory)*

### Functional Requirements

#### Persistence

- **FR-001**: The system MUST persist the active-Storyboard selection
  inside the plot's GeoJSON FeatureCollection as a `SystemState`
  feature with `kind: SYSTEM`, `state_type: active_storyboard`,
  `id: state.activestoryboard`, and `properties.active_storyboard_id`
  set to the chosen Storyboard's `properties.id`. The selection is
  identified by Storyboard ID (not by name, position, or any other
  field that can collide or change).
- **FR-002**: At most one `SystemState` feature with
  `state_type: active_storyboard` MUST be present in any
  FeatureCollection. The shared helper introduced by this feature
  MUST enforce single-entry semantics on every write (replacing or
  upserting, never appending).
- **FR-003**: The system MUST write the `SystemState` feature to the
  plot **immediately** when the analyst overrides the active
  Storyboard via the dropdown, via the existing plot-edit pipeline
  (`@debrief/stac-writer` from #236 / #242). The analyst MUST NOT
  have to perform a save action or close the plot for the selection
  to be recorded. The write travels through the same path as any
  other Storyboard / Scene CRUD edit.
- **FR-004**: The persistence MUST live in the plot file itself
  (FeatureCollection-level), NOT in user-config, browser
  localStorage, or any per-host store. The selection follows the
  plot file when it is moved, copied, or shared.

#### Restoration on plot open

- **FR-005**: On plot open, the system MUST scan the FeatureCollection
  for a `SystemState` feature with `state_type: active_storyboard`.
  If one exists **and** its `active_storyboard_id` corresponds to a
  Storyboard present in the plot, the panel MUST initialise the
  active Storyboard to that ID.
- **FR-006**: If no such `SystemState` feature exists, or its
  `active_storyboard_id` is no longer present in the plot, the panel
  MUST fall back to `getActiveStoryboardDefault()` — preserving
  today's behaviour for first-ever opens and stale-record cases.
- **FR-007**: When a fallback per FR-006 occurs because the recorded
  ID is stale (Storyboard was deleted), the system MUST overwrite
  the stale `SystemState` feature with the chosen fallback's
  Storyboard ID at the next moment a fresh selection is established
  (either via fallback completing on open or via the analyst's
  first dropdown interaction). No banner, toast, or modal
  explanation MUST be shown for this self-healing.

#### Behavioural parity across hosts

- **FR-008**: Both hosts (VS Code and web-shell) MUST exhibit the
  same persistence behaviour from the analyst's perspective: a
  selection pinned in either host is honoured on subsequent opens
  in **either** host, because the `SystemState` feature lives in
  the plot file. Unlike the previous (rejected) per-host plan, no
  cross-host sync infrastructure is required — the plot file IS
  the sync layer.
- **FR-009**: The dropdown's existing UX from #235 MUST be unchanged
  by this feature — same layout, same labels, same placement, same
  keyboard affordances. The only observable change is which
  Storyboard is selected on plot open.

#### Multi-analyst safety

- **FR-010**: Two analysts opening the same plot file see the same
  `active_storyboard_id` (the most recently pinned). This is the
  intentional per-plot SHARED semantic of Path D and matches the
  existing semantics of all other `SystemState` variants
  (`temporal`, `spatial`, `selection`). Per-user-within-shared-plot
  view memory is explicitly out of scope; if it later becomes a
  requirement, it warrants a separate user-identity model and a new
  feature spec.

#### Robustness

- **FR-011**: A read failure when scanning for the `SystemState`
  feature (e.g. corrupt FeatureCollection, parse error) MUST NOT
  prevent the panel from rendering. The host falls back to
  `getActiveStoryboardDefault()` and at most writes a single
  non-fatal log entry. (The plot-load itself is governed by the
  existing parser and may surface its own error UX — this FR
  applies only to the scan for the active-Storyboard
  `SystemState` after a successful plot load.)
- **FR-012**: A write failure when persisting the selection
  inherits the existing plot-save failure UX from
  `@debrief/stac-writer` (#236 / #242). This feature does not
  invent a separate failure UX for selection writes — they are
  plot edits and follow the established failure path.
- **FR-013**: The persistence layer MUST tolerate concurrent writes
  from two sessions on the same plot via last-writer-wins
  semantics, matching the existing plot-edit concurrency model from
  #235 research §9. No additional locking, conflict prompts, or
  merge UI is required.
- **FR-014**: Provenance/log behaviour from #235 (which records
  Scene and Storyboard CRUD into the plot's `provenance` chain)
  MUST NOT be extended by this feature. Persisting an
  active-Storyboard selection is a state-pin act, not a content
  edit, so it MUST NOT add a provenance entry on the plot or the
  `SystemState` feature itself. (The `SystemState` LinkML class has
  its own `provenance` field, which this feature leaves empty —
  documented in data-model.md.)

### Key Entities

- **`SystemState` feature with `state_type: active_storyboard`**:
  A single GeoJSON Feature inside the plot's FeatureCollection that
  stores the analyst's last-selected Storyboard ID for that plot.
  Defined by the LinkML `SystemState` class with the new
  `state_type` permitted value `active_storyboard` and the new
  optional `properties.active_storyboard_id` slot. ID format
  `state.activestoryboard` (matches the existing `^state\.[a-z]+$`
  pattern enforced by the LinkML schema). Geometry is the existing
  `GeoJSONEmptyPoint` shared by all `SystemState` features.
  Lifetime: written via the plot-edit pipeline whenever the analyst
  overrides via the dropdown; read on every plot open; overwritten
  in place on stale-fallback self-heal.
- **`active_storyboard_id` (new optional slot)**: The
  `properties.id` of the Storyboard the analyst last selected for
  this plot. Type: string (Storyboard IDs are ULID-shaped per
  #215). Optional; if absent, the panel falls back to
  `getActiveStoryboardDefault()`. Source of truth: the
  `StoryboardFeature.properties.id` field as defined by #215. The
  helper introduced by this feature treats the field as opaque on
  write and validates membership in `plot.features` on read.

## User Interface Flow

### Decision Analysis

- **Primary Goal**: When opening a multi-storyboard plot anyone has
  worked on before, the analyst lands on the Storyboard the previous
  user was last working on — no re-navigation, no mental check.
- **Key Decision(s)**:
  1. *Which Storyboard to work on now?* — exactly the same decision
     as today; the dropdown's options and labels are unchanged.
  2. *Should I revert to the default Storyboard?* — the analyst
     answers this by picking the default Storyboard from the
     dropdown explicitly. There is no separate "clear pin"
     affordance in this spec.
- **Decision Inputs**: The header dropdown shows the same Storyboard
  list as #235 — Storyboard names with their Scene counts. The
  selected entry is the persisted choice (or the default if none),
  visually identical to today's selected-state styling.

### Screen Progression

| Step | Screen/State | User Action | Result |
|------|--------------|-------------|--------|
| 1 | Plot open, header shows persisted Storyboard `B` selected (or default if no `SystemState` feature with `state_type: active_storyboard`) | Analyst inspects panel | Scene list, on-map rectangles, and time controller all reflect `B` exactly as if `B` had been picked manually — no transition or animation specific to "restoration" |
| 2 | Header dropdown open | Analyst clicks Storyboard `C` | Active Storyboard switches to `C` (same as today's #235 behaviour); the host writes the `SystemState` feature with `active_storyboard_id: C` to the plot file via the existing edit pipeline, before the next render completes |
| 3 | Plot is closed, reopened later (by anyone) | Plot opens | Header lands on `C` (the most recent pinned choice), not on `getActiveStoryboardDefault()` |
| 4 | Persisted Storyboard was deleted in another session | Plot opens | Header lands on `getActiveStoryboardDefault()` over the remaining Storyboards; no banner or warning is shown; the stale `SystemState` feature is overwritten with the new default's ID |

### UI States

- **Empty State** *(no Storyboards on plot)*: Identical to #235's
  "Empty State (no Storyboards on plot)". No persistence
  consideration applies; any pre-existing `SystemState` feature
  with `state_type: active_storyboard` is inert.
- **First-open / no SystemState feature**: Identical to today —
  `getActiveStoryboardDefault()` is selected. The user cannot tell
  whether they're on a "default" or a "restored" Storyboard, and
  that is intentional: the dropdown looks and behaves the same in
  both cases.
- **Loading State**: The panel mounts using the same plot-load
  pipeline that already feeds it `plot.features`. The
  `SystemState` scan is an in-memory walk of the already-loaded
  FeatureCollection — no separate loading affordance is needed.
- **Error State**: A `SystemState` parse / scan failure MUST NOT
  surface a visible error in the panel. The panel renders normally
  on the default selection. At most a single non-fatal log entry
  is written. Plot-save failures (which would prevent the
  selection write from persisting) inherit the existing
  `@debrief/stac-writer` failure UX (#236 / #242).
- **Success State**: The plot opens directly on the
  most-recently-pinned Storyboard. There is no success toast, no
  banner, no "you're on the last Storyboard" affordance — silence
  is the success state, because the goal of the feature is that
  the right Storyboard is *already* there.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a plot with ≥2 Storyboards that has been pinned
  to a non-default Storyboard, **100% of subsequent plot opens by
  any analyst (any host, any machine that has the plot file)
  reopen on the pinned Storyboard** — until the pinned Storyboard
  is deleted or another analyst re-pins.
- **SC-002**: For a plot that has never had a Storyboard pinned,
  **the active Storyboard on open matches today's default rule
  exactly** — `getActiveStoryboardDefault()` (the
  most-recently-modified Storyboard). Verified by replaying the
  existing #235 / #217 acceptance scenarios for default selection;
  none must regress.
- **SC-003**: When the remembered Storyboard is no longer in the
  plot (deleted in another session), **the panel renders on
  `getActiveStoryboardDefault()` with no banner, toast, or modal**.
  The fallback completes within the same render cycle as a normal
  plot open — i.e. the analyst MUST NOT see a flash of "loading"
  or "Storyboard not found" content before the fallback paints.
- **SC-004**: A plot file pinned in VS Code is honoured on the
  next open in web-shell (and vice-versa), because the
  `SystemState` feature lives in the plot file. Verified by
  copying a pinned plot file between hosts in a Playwright
  fixture and asserting the dropdown lands on the pinned
  Storyboard.
- **SC-005**: The LinkML schema change (new `SystemStateTypeEnum`
  permitted value + new optional `active_storyboard_id` slot) is
  **strictly additive**. The existing schema round-trip and
  golden-fixture suites pass without modification (existing
  fixtures lack the new field; the field is optional). One new
  fixture is added covering a plot with the new `SystemState`
  feature; that fixture round-trips Python ↔ JSON ↔ TypeScript
  byte-stable.
- **SC-006**: A `SystemState` parse / scan failure does not block
  any analyst action: panel renders, dropdown works, plot is
  editable. The host falls back to `getActiveStoryboardDefault()`
  and writes a single non-fatal log entry.

## Assumptions

- **The `SystemState` LinkML pattern is the right home**: The
  `SystemState` GeoJSON Feature class is defined in
  `shared/schemas/src/linkml/geojson.yaml` for "non-spatial system
  state" with permitted variants `temporal`, `spatial`,
  `selection`. Adding `active_storyboard` is a non-breaking,
  additive extension that matches the established pattern (per-plot,
  shared, lives inside the FeatureCollection). The active-Storyboard
  selection becomes the first runtime consumer of this pattern;
  prior to this feature, the pattern was schema-defined but
  unconsumed by production code.
- **Per-plot SHARED semantics are correct for this feature**: The
  spec's earlier per-user / per-host framing (FR-010 inverted, US1
  #3 inverted) was rejected on `/speckit.review`. Collaborative
  multi-analyst review is a first-class case for Debrief, and the
  semantic "any analyst opening this plot lands where the previous
  one was" is more useful than per-user isolation. Per-user-within-
  shared-plot view memory is captured as a separate backlog item
  for future evaluation.
- **The plot-edit pipeline already covers writes**: The persistence
  write travels through the same `@debrief/stac-writer` /
  storyboard-edit pipeline that #235 / #236 / #242 already use for
  Storyboard / Scene CRUD. No new write infrastructure is
  introduced; the new helper produces a Feature mutation and the
  existing pipeline persists it.
- **No migration of existing plots is required**: First open of any
  plot under the new behaviour reads `null` from the
  `SystemState` scan (no entry exists), so the panel falls back
  to `getActiveStoryboardDefault()` exactly as today. The
  `SystemState` feature only starts existing the first time the
  analyst overrides the active Storyboard. Older host versions
  that don't recognise the new `state_type` value treat the
  feature as inert (the parser accepts it because the slot is
  optional and the enum extension is additive).
- **Provenance is not the right place for this**: Active-Storyboard
  selection is a state-pin act, not a content edit, and per
  FR-014 it MUST NOT enter the plot's `provenance` chain. This
  keeps plot diffs noise-free and avoids leaking pin history into
  shared plot files.

## Dependencies

- **`SystemState` LinkML class** must already exist in
  `shared/schemas/src/linkml/geojson.yaml` (it does — defined
  alongside `SystemStateProperties` and the
  `SystemStateTypeEnum` in `common.yaml`). This feature extends
  both, additively.
- **`@debrief/stac-writer`** plot-edit pipeline (from #236 /
  #242) must already be wired in both hosts for Storyboard /
  Scene CRUD writes (it is — used by #235's edit suite). The
  active-Storyboard write reuses it unchanged.
- **#235 storyboard capture & maintenance UX** ships first; this
  spec amends one paragraph of #235 research §8 ("Active-Storyboard
  selection is session-scoped, not persisted") to "Active-Storyboard
  selection is persisted per-plot via #237 (in-plot `SystemState`
  feature)".
- **#215 storyboarding schema + CRUD core** is unchanged. No
  `is_active` slot is added to `StoryboardFeature`;
  `getActiveStoryboardDefault()` remains the default-selection
  rule. The schema change is on `SystemStateTypeEnum` and
  `SystemStateProperties`, not on `StoryboardFeature`.

## Out of Scope

- **Per-user-within-shared-plot view memory**: Two analysts
  collaborating on the same plot share the pinned selection
  (last-writer-wins). If a future need emerges for "remember
  *my* last view of this plot, separately from the team's", that
  warrants a user-identity model the project does not have today
  and is captured as backlog item #251 for separate evaluation.
- **`debrief-config` / browser-localStorage persistence**: The
  earlier draft of this spec proposed per-host stores
  (`debrief-config` for VS Code, `localStorage` for web-shell).
  That approach was rejected on `/speckit.review` in favour of
  in-plot persistence. The user-config / localStorage path is
  not an alternative; it is explicitly deprecated for this
  concern.
- **`is_active` slot on `StoryboardFeature`**: The other
  schema-level option flagged in the backlog item — adding an
  `is_active` boolean to `StoryboardFeature` itself — is rejected.
  It would put UI-state on the data Feature, allow multiple
  Storyboards to be `is_active: true` simultaneously (no schema
  invariant prevents it), and miss the point of the existing
  `SystemState` pattern.
- **Pin-selection UI on the panel**: This spec does not add a
  visual "pinned" indicator, "clear pin" affordance, or any
  other UI surface to the panel. The header dropdown is
  unchanged. If user research later shows analysts want to see
  "this plot is pinned to X", that is a separate UX feature.
- **Storyboard ordering, listing UX, or selection-by-name**: Any
  Storyboard-list affordances beyond what #235 already ships are
  out of scope.
- **Migration tooling**: No migration runs against pre-existing
  plot files. First open under the new behaviour is identical to
  today (no `SystemState` feature → default fallback).
