# Timeline Plugin for Obsidian

Display timeline cards on an infinite canvas with pan/zoom capabilities.

## Features

- **Infinite canvas** with smooth panning and zooming (trackpad, mouse wheel, and touch)
- **Timeline cards** positioned by date, drawn from note frontmatter
- **Arbitrary date ranges** from 10 billion years BCE to 10 billion years CE using Julian Day Number algorithms
- **Multi-select** cards with Shift+click
- **Drag and drop** to move cards across layers and time
- **Resize** card start/end dates by dragging edges
- **Color coding** via frontmatter or context menu
- **Undo/redo** for move, resize, and layer-change operations
- **Multiple timelines** scoped to folders, with timeline-reference cards
- **Viewport persistence** across sessions (camera position and zoom are saved)

## Installation

1. Clone or copy this repo into your vault's `.obsidian/plugins/timeline/` folder.
2. Run `npm install` then `npm run build`.
3. Reload Obsidian and enable **Timeline** in **Settings -> Community plugins**.

## Usage

### Creating timeline items

Add `timeline: true`, `date-start`, and `date-end` to any note's frontmatter:

```yaml
---
timeline: true
date-start: 2024-03-15
date-end: 2024-06-20
color: blue
---
```

### Date format

Standard: `YYYY-MM-DD`
Extended: `YYYY BCE-MM-DD` or `-YYYY-MM-DD`

### Commands

| Command | Description |
|---------|-------------|
| **Open Timeline view** | Open the timeline selector (ribbon icon or command palette) |
| **Undo / Redo** | Undo/redo the last card move, resize, or layer change |
| **Go to note** | Fuzzy-find and center on a specific timeline card |
| **View in Timeline** | Jump to the current note's card in the best-matching timeline |
| **Add Timeline** | Add a reference card for another timeline |

### Configuring timelines

Open **Settings -> Timeline** to create named timelines scoped to specific folders.  Each timeline scans its configured folder recursively for notes with `timeline: true` frontmatter.

## Development

```bash
npm install          # Install dependencies
npm run dev          # Watch mode (live-rebuild)
npm run build        # Production build (type-check + minify)
npm run test         # Run vitest test suite
npm run lint         # Run eslint
```

## Scale-based display

The timeline adjusts date display based on zoom level:

| Scale Level | Display | Example |
|-------------|---------|---------|
| Days | DD/MM/YYYY | 15/03/2024 |
| Months | MM/YYYY | 03/2024 |
| Years | YYYY CE/BCE | 2024 CE |
| Decades | 10-year notation | 2020s |
| Centuries | century notation | 21st century |
| Millennia | k-years | 3k BCE |
| Millions | M-years | 4.5M BCE |
| Billions | B-years | 4.5B BCE |

## License

0-BSD
