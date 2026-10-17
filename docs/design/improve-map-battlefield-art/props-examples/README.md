# Individual map prop wireframes

24 original technical wireframe placeholders, each supplied as a **512 × 512 transparent PNG** and an **editable SVG**. They reuse the vector diagrams from the [prop concept sheet](../04-map-prop-ideas.svg). These files support layout, registration and content discussions; painted production art and runtime registration remain separate work.

[manifest.json](manifest.json) lists every file, stable ID, source icon ID, name, descriptive tags, category, ground anchor and suggested footprint. All entries explicitly set `placeholder: true`, `status: "wireframe-placeholder"` and `pngAssetId: null`. File paths are relative to the manifest. The draft [discovery example](../map-discovery.example.json) keeps its production asset references unfilled.

| Stable ID | PNG | Editable SVG |
| --- | --- | --- |
| `bridge` | [PNG](bridge.png) | [SVG](bridge.svg) |
| `path` | [PNG](path.png) | [SVG](path.svg) |
| `tunnel` | [PNG](tunnel.png) | [SVG](tunnel.svg) |
| `cave` | [PNG](cave.png) | [SVG](cave.svg) |
| `ferry` | [PNG](ferry.png) | [SVG](ferry.svg) |
| `ford` | [PNG](ford.png) | [SVG](ford.svg) |
| `portal` | [PNG](portal.png) | [SVG](portal.svg) |
| `boat` | [PNG](boat.png) | [SVG](boat.svg) |
| `city` | [PNG](city.png) | [SVG](city.svg) |
| `town` | [PNG](town.png) | [SVG](town.svg) |
| `village` | [PNG](village.png) | [SVG](village.svg) |
| `ruins` | [PNG](ruins.png) | [SVG](ruins.svg) |
| `dungeon` | [PNG](dungeon.png) | [SVG](dungeon.svg) |
| `treasure` | [PNG](treasure.png) | [SVG](treasure.svg) |
| `enemy-camp` | [PNG](enemy-camp.png) | [SVG](enemy-camp.svg) |
| `rest-camp` | [PNG](rest-camp.png) | [SVG](rest-camp.svg) |
| `inn` | [PNG](inn.png) | [SVG](inn.svg) |
| `trainer` | [PNG](trainer.png) | [SVG](trainer.svg) |
| `merchant` | [PNG](merchant.png) | [SVG](merchant.svg) |
| `shrine` | [PNG](shrine.png) | [SVG](shrine.svg) |
| `watchtower` | [PNG](watchtower.png) | [SVG](watchtower.svg) |
| `cartographer` | [PNG](cartographer.png) | [SVG](cartographer.svg) |
| `mine` | [PNG](mine.png) | [SVG](mine.svg) |
| `fishing` | [PNG](fishing.png) | [SVG](fishing.svg) |

## Placement metadata

Coordinates use the entire 512 px canvas, normalized from 0 to 1, with the origin at the top left. Every anchor is `(0.5, 0.85)`, or `(256, 435.2)` px. The export transform places the source diagram's `y = 31` baseline there. Water ripples, feet or other diagram details may extend below it. Sort placement by this anchor and align it to the intended map ground/water contact.

Footprints are provisional rectangles in the same normalized coordinates. They suggest placement space on the ground plane; they do not describe alpha bounds, collision, a click target or the number of occupied tiles. Route/ford footprints span more of the canvas because those diagrams describe a connection across an area. No reciprocal road edges or bridge orientation variants are supplied in this starter set.

IDs remain stable when labels or diagrams change. `enemy-camp` and `rest-camp` match the discovery proposal's IDs; their sheet source keys are `enemy` and `rest`. Tags describe intended visual families; they do not spawn encounters, award loot or enable travel. The cartographer diagram is a map symbol standing in for a future landmark/person prop.

## Editing and reproducible exports

Open any SVG in a vector editor to change paths, stroke widths or fills. Each file has a named prop group and contains no embedded raster image or background. PNGs contain only the diagram and alpha. They contain no baked labels or anchor/footprint guides.

The canonical vectors live in the `icons` object in [render-discovery.mjs](../render-discovery.mjs). Edit those paths to preserve a change through regeneration; direct edits to generated SVGs are overwritten. Edit [prop-definitions.mjs](prop-definitions.mjs) for stable IDs, tags, categories and provisional footprints. The generator writes `manifest.json`; change its metadata sources instead of editing that output.

From the repository root, with Node.js and Sharp available:

```sh
node docs/design/improve-map-battlefield-art/render-discovery.mjs --props-only
node docs/design/improve-map-battlefield-art/props-examples/validate.mjs
```

Omit `--props-only` to rebuild both existing concept sheets as well. Identical sources and the same Sharp version produce identical exports. No image generation, image editing service, game source change or HTML tool is involved.

Validation checks all 24 unique IDs, file references, placeholder flags, coordinates, PNG dimensions/alpha/transparent edges, SVG dimensions and agreement between each vector and its raster export.
