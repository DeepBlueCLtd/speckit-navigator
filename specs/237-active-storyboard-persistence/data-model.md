# Data Model — Active-Storyboard Selection Persistence

**Feature**: #237
**Date**: 2026-05-06 (rewritten 2026-05-07 after `/speckit.review` pivot to Path D)

This feature introduces one schema-level entity (a new permitted
variant of `SystemStateTypeEnum`) and one new optional slot on
`SystemStateProperties`. Both are additive. The "data model" below
describes the schema extension, the helper-enforced invariants, and
the lifecycle of the new entity inside the plot's FeatureCollection.

> **Note on history**: An earlier draft of this document described a
> per-host JSON-map persistence model (`debrief-config` for VS Code,
> `localStorage` for web-shell). On `/speckit.review` the user
> directed in-plot persistence via the existing `SystemState` LinkML
> pattern. This rewrite replaces the per-host model entirely.

---

## Schema entity: `SystemState` feature with `state_type: active_storyboard`

A single GeoJSON Feature inside the plot's FeatureCollection,
defined by the existing LinkML `SystemState` class with the new
permitted `state_type` value.

### Schema diff

**File**: `shared/schemas/src/linkml/common.yaml`

```yaml
  SystemStateTypeEnum:
    description: Discriminator for system state variants
    permissible_values:
      temporal:
        description: Time viewport state (start/end times)
      spatial:
        description: Map viewport state (bbox, zoom)
      selection:
        description: Feature selection state (selected IDs)
      active_storyboard:                        # ← NEW
        description: Per-plot active-Storyboard pin (#237)
```

**File**: `shared/schemas/src/linkml/geojson.yaml`

```yaml
  SystemStateProperties:
    description: Properties for SYSTEM features storing application state
    attributes:
      kind:
        description: Feature type discriminator
        range: FeatureKindEnum
        required: true
        equals_string: "SYSTEM"
      state_type:
        description: Discriminator for state variant (temporal, spatial, selection, active_storyboard)
        range: SystemStateTypeEnum
        required: true
      # Temporal viewport fields (when state_type = temporal) … unchanged
      # Spatial viewport fields (when state_type = spatial) … unchanged
      # Selection state fields (when state_type = selection) … unchanged
      # Active-storyboard fields (when state_type = active_storyboard)
      active_storyboard_id:                     # ← NEW
        description: Storyboard properties.id the analyst last pinned for this plot (#237)
        range: string
      provenance:                                # … unchanged
        …
```

Both edits are **strictly additive**. Existing fixtures still
validate. Existing parsers continue to accept all
currently-valid inputs.

### Logical shape of the runtime feature

```ts
type SystemStateFeature = {
  type: "Feature";
  id: "state.activestoryboard";          // matches existing ^state\.[a-z]+$ regex
  geometry: { type: "Point", coordinates: [] };  // GeoJSONEmptyPoint
  properties: {
    kind: "SYSTEM";
    state_type: "active_storyboard";
    active_storyboard_id: string;        // the StoryboardFeature.properties.id
    // (provenance: LogEntry[] is allowed by the schema but always empty for #237 — see FR-014)
  };
};
```

### Storage location

Inside the plot's GeoJSON FeatureCollection, alongside Storyboard,
Scene, Track, etc. features. The plot's STAC item points at this
FeatureCollection via `assets.payload.href` per the existing
plot-storage convention; the `SystemState` feature is persisted
through the same `@debrief/stac-writer` pipeline that writes
every other Feature mutation.

### Field reference

| Field | Type | Description | Source of truth |
|-------|------|-------------|-----------------|
| `type` | `"Feature"` | GeoJSON discriminator (existing `SystemState` schema). | Schema constant. |
| `id` | `"state.activestoryboard"` | Stable Feature ID. Matches the existing `^state\.[a-z]+$` regex on `SystemState.id`. Lowercased + no separator (per regex). | Helper constant. |
| `geometry` | `GeoJSONEmptyPoint` (`Point` with empty coordinates) | Required by the existing `SystemState` schema for all SYSTEM features. | Schema constant. |
| `properties.kind` | `"SYSTEM"` | Discriminator. Matches `FeatureKindEnum.SYSTEM`. | Schema constant. |
| `properties.state_type` | `"active_storyboard"` | Discriminator. The new permitted value introduced by this feature. | Schema permitted value (NEW). |
| `properties.active_storyboard_id` | `string` (Storyboard `properties.id`, ULID-shaped per #215) | The Storyboard the analyst last pinned for this plot. Optional in the schema; absent on first open. | `StoryboardFeature.properties.id` of the picked Storyboard. |
| `properties.provenance` | `LogEntry[]` (optional) | Allowed by the existing `SystemStateProperties` schema. **Always empty for #237** per FR-014; any contrib code that populates it is documented as out-of-spec. | (unused — empty on every write). |

### Validation rules

- **V-1 (schema)**: `state_type` MUST be one of the permitted values
  (`temporal | spatial | selection | active_storyboard`). Enforced by
  the LinkML-generated Pydantic / JSON Schema / TypeScript types.
  Caught at parse time.
- **V-2 (helper, on read)**: `getActiveStoryboardSelection(plot)`
  returns the `active_storyboard_id` from the matching `SystemState`
  feature **only if** that ID is the `properties.id` of an
  `isStoryboardFeature` in `plot.features`. If the recorded ID is
  not present, the helper returns `null` and signals "stale" to the
  caller (so the host can self-heal per FR-007). This validation
  lives in the helper, not the schema, because the schema cannot
  express cross-feature integrity (LinkML cannot say "this string
  must be the ID of another feature in the same FeatureCollection").
- **V-3 (helper, on write — single-entry)**:
  `setActiveStoryboardSelection(plot, id)` MUST produce a
  FeatureCollection with **at most one** `SystemState` feature with
  `state_type: active_storyboard`. If one exists, it is updated in
  place; otherwise a new one is appended. If, due to upstream
  corruption, more than one exists, the helper de-duplicates and
  emits a non-fatal log warning.
- **V-4 (helper, on null write)**:
  `setActiveStoryboardSelection(plot, null)` removes the
  `SystemState` feature with `state_type: active_storyboard` from
  the FeatureCollection (rather than writing a feature with
  `active_storyboard_id: null`). Treats null as "clear this plot's
  pin", parallel to the "set null = remove entry" semantics of the
  previous draft's adapter contract.
- **V-5 (helper, on read — defensive de-dup)**: If multiple
  `SystemState` features with `state_type: active_storyboard` are
  present (e.g. from concurrent writes that bypassed V-3), the
  helper returns the `active_storyboard_id` from the first one and
  emits a non-fatal log warning. The next write through V-3 fixes
  the FeatureCollection.

### Lifecycle

| Trigger | Operation | Effect |
|---------|-----------|--------|
| Plot opens (host's `onPlotOpened` / `useEffect` on `plot` change) | `getActiveStoryboardSelection(plot)` | Returns `string \| null`. Host applies V-2; if valid, seeds `state.activeStoryboardId` (VS Code) or `activeOverrideId` (web-shell). If invalid (stale ID), falls back to `getActiveStoryboardDefault(plot)` and queues a self-heal write. |
| Analyst picks a different Storyboard from the side-rail dropdown | `setActiveStoryboardSelection(plot, storyboardId)` → emit Feature mutation through the host's plot-edit pipeline | The `SystemState` feature is upserted (V-3); the resulting FeatureCollection is persisted via `@debrief/stac-writer`. No save dialog, no provenance entry on the plot, no provenance entry on the `SystemState` feature itself. |
| Analyst creates a new Storyboard via the side rail and switches to it (existing #235 behaviour) | Same as the dropdown override path. The existing `setActiveOverrideId` post-create call site already triggers this. | Same as the dropdown override path. |
| The pinned Storyboard is deleted in another session (V-2 fails on next open) | Host falls back to default; the open-time self-heal write upserts the `SystemState` feature with the new default ID. | Self-heals on open. No banner, no toast (FR-007). |
| Plot file is moved or copied | (no operation — the `SystemState` feature travels with the plot) | The pin "follows" the plot file. New analyst opening the moved plot lands on the previous pin. This is correct per Path D's per-plot semantics. |
| `SystemState` parse fails or scan throws | Helper returns `null`, host falls back to default | Panel renders normally; one non-fatal log entry. |
| Plot save fails through `@debrief/stac-writer` | Inherits existing `#236 / #242` failure UX (toast/banner) | Selection held in-memory only; next open reverts to the previously-saved value (or default). |

### Concurrency

Two analysts writing to the same plot file simultaneously may
produce a last-writer-wins clobber on the `SystemState` feature.
Accepted per FR-013 / spec edge cases. The same concurrency model
already governs every other Feature edit on the plot — this
feature does not introduce a new concurrency mode.

### Sizing assumptions

- One `SystemState` feature with `state_type: active_storyboard`
  per plot (V-3 single-entry invariant).
- Feature payload is small: `id` ~26 chars (`state.activestoryboard`),
  empty geometry, three string properties. Total feature footprint
  comfortably under 200 bytes.
- No measurable impact on plot file size or load time.

### What is **not** in this entity

The following are explicitly out of model:

- **Per-user keying**: The `active_storyboard_id` is per-plot,
  shared across analysts. Per-user view memory is captured as
  backlog item #251 for separate evaluation.
- **History** (e.g. "the previous selection before this one").
  Spec Out-of-Scope §: no "clear pin" affordance, no history
  viewer.
- **Timestamps on the selection itself**. The `SystemState`
  feature's `provenance` slot exists in the schema but is left
  empty per FR-014. If this ever matters, a future feature can
  populate it; today the plot save's mtime (already exposed by
  `@debrief/stac-writer`) is sufficient context.
- **Provenance entry on the plot**. Per FR-14, this feature
  MUST NOT add a provenance entry to the plot's `provenance`
  chain. Selection pinning is a state-pin act, not a content
  edit.

---

## Helpers introduced by this feature

Two pure functions on the FeatureCollection plus one type-guard,
all in `shared/components/src/storyboard/` (the existing home for
`isStoryboardFeature`, `isSceneFeature`, etc.):

| Function | Signature | Behaviour |
|---|---|---|
| `isActiveStoryboardSelection(feature)` | `(f: Feature) => f is SystemStateFeature & { properties: { state_type: "active_storyboard" } }` | Type-guard. Returns true iff `feature.properties.kind === "SYSTEM"` and `feature.properties.state_type === "active_storyboard"`. Mirrors `isStoryboardFeature` / `isSceneFeature`. |
| `getActiveStoryboardSelection(plot)` | `(plot: FeatureCollection) => string \| null` | Scans `plot.features` for the first `SystemState` feature with `state_type: active_storyboard`; returns its `active_storyboard_id` or `null`. Does **not** validate plot-membership of the recorded ID — that's V-2 in the host. Implements V-5 defensive de-dup logging. |
| `setActiveStoryboardSelection(plot, id)` | `(plot: FeatureCollection, id: string \| null) => FeatureCollection` | Pure function. Returns a new FeatureCollection with the `SystemState` feature upserted (V-3) or removed (V-4). Caller (host) emits the mutation through the plot-edit pipeline. |

These helpers do NOT touch I/O — they are pure transformations.
The plot-edit pipeline owns the actual save.

---

## Relationships to existing entities

```
StoryboardFeature  (#215 LinkML schema, unchanged)
  └─ properties.id  ◄──────────────────────────┐
                                                │ stores
SceneFeature (#215 LinkML, unchanged)           │ (by ID)
                                                │
Plot (a FeatureCollection of features)          │
  ├─ StoryboardFeature[…]                       │
  ├─ SceneFeature[…]                            │
  ├─ TrackFeature[…]                            │
  ├─ … other data features                      │
  └─ SystemState[ state_type=active_storyboard ]│
        └─ properties.active_storyboard_id ─────┘
   (lives inside the FeatureCollection — travels with the plot file)
```

The `SystemState` feature references
`StoryboardFeature.properties.id` and lives in the same
FeatureCollection. The host validates cross-reference integrity at
read time (V-2); the helper enforces single-entry semantics at write
time (V-3 / V-4). The plot file is the single source of truth.
