# Usage Example — Active-Storyboard Selection Persistence

The persistence is invisible to the analyst. The dropdown in the
side-rail header behaves exactly like before; the only observable
change is which Storyboard is selected when a plot first opens —
it is now the last one any analyst pinned (rather than always the
most-recently-modified one).

## Helper round-trip

The three pure helpers in `@debrief/components/storyboard` are the
core contract:

```ts
import {
  getActiveStoryboardSelection,
  isActiveStoryboardSelection,
  setActiveStoryboardSelection,
} from '@debrief/components';

// Read the persisted active-Storyboard ID from the plot.
//   - Returns null when no SystemState entry exists.
//   - Defensive de-dup: if multiple matching entries exist (e.g. from
//     concurrent writes), the helper returns the first match and
//     emits one non-fatal log warning.
const persistedId = getActiveStoryboardSelection(plot);
//   typeof persistedId === 'string' | null

// Write the active-Storyboard ID into the plot.
//   - Upserts at most one SystemState feature with state_type=active_storyboard
//   - Pure: returns a NEW FeatureCollection; the input is never mutated
const next = setActiveStoryboardSelection(plot, 'sb-B');

// Subsequent read returns the new ID.
getActiveStoryboardSelection(next);
//   → 'sb-B'

// Pass null to clear the pin entirely (V-4).
const cleared = setActiveStoryboardSelection(next, null);
getActiveStoryboardSelection(cleared);
//   → null
```

## Host wiring

The shared helpers don't touch I/O. The host mount layers (VS Code
`StoryboardPlaybackService`, web-shell `StoryboardPanelMount`) call
the helpers to compute the next `FeatureCollection`, then route the
write through the existing plot-edit pipeline (`@debrief/stac-writer`
in the web-shell, `MapPanel.setFeatures` in the VS Code extension).

VS Code wiring (excerpt from `apps/vscode/src/services/storyboardPlayback.ts`):

```ts
import {
  getActiveStoryboardSelection,
  setActiveStoryboardSelection,
} from '@debrief/components';

public onPlotOpened(documentUri: string): void {
  const plot = plotFromFeatures(this.mapPanel.getCurrentFeatures());
  // … existing default-selection logic …
  const persisted = getActiveStoryboardSelection(plot);
  if (persisted !== null) {
    const stillExists = plot.features.some(
      (f) => isStoryboardFeature(f) && f.properties.id === persisted,
    );
    if (stillExists) {
      state.activeStoryboardId = persisted;
    } else if (state.activeStoryboardId !== null) {
      // V-2 self-heal — overwrite the stale entry through the existing
      // plot-edit pipeline. No banner, no toast.
      const healed = setActiveStoryboardSelection(plot, state.activeStoryboardId);
      this.mapPanel.setFeatures(featuresFromPlot(healed));
    }
  }
  // … rest of onPlotOpened …
}

public setActiveStoryboard(documentUri: string, storyboardId: string | null): void {
  // … existing in-memory state update …
  const persisted = setActiveStoryboardSelection(plot, storyboardId);
  this.mapPanel.setFeatures(featuresFromPlot(persisted));
}
```

Web-shell wiring (excerpt from `apps/web-shell/src/StoryboardPanelMount.tsx`):

```ts
import {
  persistActiveStoryboardId,
  readPersistedActiveStoryboardId,
} from './services/activeStoryboardPersistence';

// On mount-time read — seed React state from the SystemState feature.
const [activeOverrideId, setActiveOverrideId] = React.useState<string | null>(
  () => readPersistedActiveStoryboardId(featureCollection).id,
);

// On dropdown change — persist via the existing plot-edit pipeline.
const onActiveStoryboardChange = useCallback(
  (storyboardId: string) => {
    setActiveOverrideId(storyboardId);
    persistActiveStoryboardId(featureCollection, storyboardId, setFeatureCollection);
  },
  [featureCollection, setFeatureCollection],
);
```

## When each runs

- **Mount-time read** runs once per plot-open in both hosts. The host
  reads the persisted ID, validates it is still a Storyboard in the
  plot (V-2), and either honours it or self-heals to the default
  through the same edit pipeline.
- **Dropdown change** runs whenever the analyst picks a different
  Storyboard from the side-rail header dropdown. The new ID is
  written immediately — no save dialog, no provenance entry on the
  plot or on the SystemState feature itself.

The user-facing flow is: close the plot, reopen it (in either host,
on any machine that has the plot file), and the panel restores the
last analyst's pinned Storyboard. The `SystemState` feature travels
with the plot file, so VS Code → web-shell parity is structural —
no cross-host sync infrastructure required.
