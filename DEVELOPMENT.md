# Development guide

Quick reference for developers working on this codebase.

## Coordinate system

The plugin uses a **split X/Y coordinate system**:

```
X-axis:  screenX = worldX + translateX        (NO scale multiplier)
Y-axis:  screenY = worldY * scale + translateY
```

- `timeScale` (pixels per day) controls X-axis density. Changing it changes
  how many pixels one day occupies. `worldX = days * timeScale`.
- `scale` only affects **vertical zoom** (Y-axis).
- `translateX` / `translateY` are camera pan offsets.

**Conversions live in:**

| What | Where |
|------|-------|
| Day / worldX / screenX | `TimeScaleManager` (X-axis only) |
| Full 2D world / viewport | `CameraSystem` (both axes) |
| Card clamping + visibility | `CardCameraRenderer` |
| Layer / Y position | `LayerManager.layerToY()` / `yToLayer()` |

Do **not** inline coordinate math. Always call the utility.

## Card behaviour

Cards sit on layers. A layer is an integer; layer 0 is at Y = 0.
`LayerManager.layerToY(layer)` and `yToLayer(y)` convert between them.
`GRID_SPACING` (50 world units) is the vertical distance between layers and
is exported from `LayerManager`.

Layer assignment uses an alternating search (+1, -1, +2, -2, ...) starting
from a preferred layer (usually cached or 0). This logic lives **only** in
`LayerManager.assignLayers()`. Services that need layer assignment call
`LayerManager` -- they do not reimplement the algorithm.

There are two card types (`TimelineItem` discriminated union):

| Type | Key | Description |
|------|-----|-------------|
| `note` | `file: TFile` | A vault markdown file with timeline frontmatter |
| `timeline` | `timelineId` | A reference to another timeline (shows its span) |

Type definitions are in `src/types/timelineTypes.ts`.

## Data flow

```
User action in Svelte component
  │  callback prop (onItemResize, onItemMove, etc.)
  ▼
TimelineView (coordinator)
  │  delegates to the appropriate service
  ▼
Service module (CardOperations, NoteCreator, etc.)
  │  calls FileService / TimelineCacheService as needed
  ▼
TimelineView calls component.refreshItems(items)
```

- **State owner**: `TimelineView` owns `timelineItems[]` and `SelectionManager`.
- **Optimistic updates**: `Timeline.svelte` keeps a local copy of items for
  flicker-free drag/resize. On `finished: true` it notifies the parent.
- **Viewport state**: Owned by `InfiniteCanvas.svelte`, saved to cache via
  debounced `onViewportChanged` callback.

There is **no global Svelte store**. All data flows via props down and
callbacks up.

## Where logic lives

| Concern | Module |
|---------|--------|
| Plugin lifecycle, commands | `main.ts` |
| Coordinating view + services | `views/TimelineView.ts` |
| Multi-selection state | `services/SelectionManager.ts` |
| Move / resize / layer / color | `services/CardOperations.ts` |
| Remove / trash cards | `services/CardDeletion.ts` |
| Create notes from clicks | `services/NoteCreator.ts` |
| Timeline-reference cards | `services/TimelineCardManager.ts` |
| Right-click context menu | `services/ContextMenuBuilder.ts` |
| Vault file scanning | `services/FileService.ts` |
| Disk cache (viewport, layers) | `services/TimelineCacheService.ts` |
| Undo / redo stack | `utils/TimelineHistoryManager.ts` |
| X-axis conversions + markers | `utils/TimeScaleManager.ts` |
| 2D coordinate transforms | `utils/CameraSystem.ts` |
| Card viewport clamping | `utils/CardCameraRenderer.ts` |
| Layer overlap + assignment | `utils/LayerManager.ts` |
| Arbitrary-range dates (JDN) | `utils/TimelineDate.ts` |
| Debug logging | `utils/debug.ts` |

### Svelte components

| Component | Role |
|-----------|------|
| `Timeline.svelte` | Root wrapper; forwards props, manages optimistic state during drag |
| `InfiniteCanvas.svelte` | Pan/zoom viewport, cursor snapping, boundary lines |
| `TimelineCard.svelte` | Single card: resize handles, move, animated snapping |
| `TimelineHeader.svelte` | Date header bar with markers and hover indicator |
| `GridLines.svelte` | Horizontal layer grid lines |

### Shared constants and types

- `GRID_SPACING` is exported from `LayerManager`.
- `CardHoverData` is exported from `types/timelineTypes.ts`.
- `TimelineColor` is exported from `LayerManager`.
- `TimelineItem`, `NoteTimelineItem`, `TimelineRefItem` are in
  `types/timelineTypes.ts`.

## Adding new features

- **New card mutation** (e.g. batch move): Add to `CardOperations.ts`. Use
  `FileService.updateFileDatesStatic()` for frontmatter writes.
- **New service**: Create a file in `services/`, export pure functions or a
  lightweight class. Wire it from `TimelineView`.
- **New coordinate conversion**: Add to `TimeScaleManager` (X-only) or
  `CameraSystem` (2D). Never inline the math.
- **Layer-related logic**: Use `LayerManager`. Do not reimplement
  `isLayerBusy` or the alternating search.
