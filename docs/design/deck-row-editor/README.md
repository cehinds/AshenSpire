# Card row layout reference editor

Open `http://127.0.0.1:4340/docs/design/deck-row-editor/` while the repository server is running. The editor loads real game artwork through `assetUrl()`.

- Select any of the thirteen components in the layer list or directly in the row.
- Drag to move; drag its lower-right corner to resize. Artwork scales proportionally inside its frame.
- Snapping aligns to the grid and visible peers' edges/centres. Cyan guides show the active alignment. Hold Alt while dragging to bypass snapping.
- Edit exact position, dimensions, font size and visibility in the inspector. Arrow keys move one pixel; Shift moves ten.
- MP uses the blue diamond and SP the round green orb; their numbers are separate editable layers. Optional harness and action sigil layers start hidden.
- Toggle wireframe to inspect component boundaries. Description is bottom-aligned and clips at two lines.
- Change row width and height; all elements remain within the row.
- Copy or download the JSON, or paste/open a version 1 JSON file and import it. Invalid imports leave the current layout intact. Reset restores the supplied 520 × 86 layout.
- Changes persist as a browser-local draft. This reference editor never changes game configuration or a save.

Run pure geometry/import tests with `node --test docs/design/deck-row-editor/layout.test.mjs`.
