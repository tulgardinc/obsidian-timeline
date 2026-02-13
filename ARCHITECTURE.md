# Architecture

This document describes the module structure, conventions, and coordinate
system used by the Timeline plugin.

## Directory layout

```
src/
  main.ts                         # Plugin entry point (lifecycle, commands)
  settings.ts                     # Settings UI + TimelineViewConfig type
  views/
    TimelineView.ts               # Obsidian ItemView – top-level coordinator
  services/
    SelectionManager.ts           # Card selection state (multi-select, active)
    CardOperations.ts             # Move / resize / layer-change / color
    CardDeletion.ts               # Remove-from-timeline / move-to-trash
    NoteCreator.ts                # Create notes from canvas clicks
    TimelineCardManager.ts        # Timeline-reference card collection & refresh
    ContextMenuBuilder.ts         # Right-click context menu (Obsidian Menu API)
    FileService.ts                # Collect note cards from vault files
    TimelineCacheService.ts       # Disk-backed cache (viewport, layers, IDs)
  stores/
    timelineStore.ts              # Shared type definitions (TimelineItem, etc.)
  components/                     # Svelte 5 UI components
    Timeline.svelte               # Root wrapper, prop forwarding
    InfiniteCanvas.svelte         # Pan/zoom viewport, marker rendering
    TimelineCard.svelte           # Individual card rendering & interaction
    TimelineHeader.svelte         # Date header bar
    GridLines.svelte              # Horizontal grid lines
    MarkdownInfoView.svelte       # Markdown preview popover
  contexts/
    ViewportContext.ts            # Svelte context for viewport state getters
  modals/
    DeleteConfirmModal.ts         # Delete/remove confirmation dialog
    TimelineItemSuggestModal.ts   # Fuzzy-find a card
    TimelineSelectorModal.ts      # Fuzzy-find a timeline to open
  utils/
    CameraSystem.ts               # 2D world ↔ viewport coordinate math
    CardCameraRenderer.ts         # Card visibility + clamping per viewport
    LayerManager.ts               # Layer assignment + overlap detection
    TimelineDate.ts               # Arbitrary-range date (Julian Day Number)
    TimelineHistoryManager.ts     # Undo/redo stack
    TimeScaleManager.ts           # X-axis time ↔ pixel conversions & markers
    ViewportClamping.ts           # Card edge clamping at viewport boundaries
    debug.ts                      # Guarded console.log (silent in production)
  types/
    obsidian-ex.d.ts              # Type augmentations for undocumented APIs
    plugin-context.ts             # TimelinePluginContext interface (DI)
```

## Architectural principles

### 1. TimelineView is a thin coordinator

`TimelineView` owns the Svelte component lifecycle and routes events to
focused service modules.  It should not contain domain logic directly.

### 2. Services are stateless functions or lightweight classes

Each service file has a single responsibility:

| Module | Responsibility |
|--------|---------------|
| `SelectionManager` | Tracks which cards are selected and the active card |
| `CardOperations` | Applies move / resize / layer / color mutations |
| `CardDeletion` | Removes cards from timeline or moves files to trash |
| `NoteCreator` | Creates a new note file from a canvas click |
| `TimelineCardManager` | Collects and refreshes timeline-reference cards |
| `ContextMenuBuilder` | Builds the Obsidian `Menu` for right-click |
| `FileService` | Scans vault files and produces `TimelineItem[]` |
| `TimelineCacheService` | Persists viewport state, layers, note IDs to disk |

### 3. Dependency injection via `TimelinePluginContext`

Services that need plugin-level data (list of timelines, opening a timeline
view) receive a `TimelinePluginContext` interface rather than accessing
`(this.app as any).plugins.plugins['timeline']`.  This keeps services
decoupled from the plugin class and makes testing straightforward.

### 4. Data flows down via props, events flow up via callbacks

Svelte components receive data as props and notify the parent via callback
props (`onItemResize`, `onItemMove`, etc.).  There is no global Svelte store;
all state is owned by `TimelineView` and pushed to the component tree.

### 5. Debug logging is guarded

All debug output goes through `src/utils/debug.ts`.  By default, logging is
disabled.  Call `setDebug(true)` at runtime to enable it.  Production builds
produce zero console output unless an error occurs.

## Coordinate system

The plugin uses a split coordinate system:

```
X-axis:  screenX = worldX + translateX        (NO scale multiplier)
Y-axis:  screenY = worldY * scale + translateY
```

- `timeScale` (pixels per day) determines the density of the X axis.
  Changing `timeScale` changes how many pixels one day occupies.
- `scale` only affects vertical zoom (Y axis).
- `translateX` / `translateY` are camera pan offsets.

All modules (`TimeScaleManager`, `CameraSystem`, `CardCameraRenderer`,
`ViewportClamping`) follow this convention.

## Type hierarchy

```
TimelineItem  (discriminated union)
  ├── NoteTimelineItem   { type: 'note',     file: TFile, ... }
  └── TimelineRefItem    { type: 'timeline',  timelineId, timelineName, ... }
```

Both share `TimelineItemBase` (x, y, width, dateStart, dateEnd, layer, color).

## Cache format

The cache is stored at `<vault>/timelines/timelines.json`:

```json
{
  "version": 1,
  "timelines": {
    "<timeline-id>": {
      "viewport": { "centerX", "centerDay", "centerY", "timeScale", "scale" },
      "notes": {
        "<note-id>": { "layer", "lastPath", "lastModified" }
      },
      "timelineCards": {
        "<referenced-timeline-id>": { "layer", "color?" }
      }
    }
  }
}
```

Notes are identified by a `timeline-id` UUID injected into their frontmatter,
making them resilient to file renames and moves.
