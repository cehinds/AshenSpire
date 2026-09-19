# AshenSpire UI Studio

A standalone local editor for the game's **layout configuration**: the JSON
under `content/config/ui/` that decides how every screen is laid out (band
splits, insets, breakpoints, minimum sizes, layers). It draws the approved
wireframes (W4a combat, W4b map, W4c dialogue, the W1 modal frame and screens,
the card face) at real device sizes, lets you drag them on a snapping grid,
validates every change with the game's own compiler, and writes the JSON back
with a backup. It also holds free-form **sketches**: wireframe boxes with
per-breakpoint overrides, saved as JSON, for layouts that do not exist yet.

Like `editor/` (Spire Studio) and `pose-studio/`, it is its own application
beside the game: no npm dependencies, no build step, Node 22+, nothing of it
ships in the game bundle.

## Open it

On Windows, double-click **Start UI Studio.cmd** in this folder (Edge app
window when Edge is present, your browser otherwise). From a terminal:

```
node ui-studio/server.mjs              # http://127.0.0.1:4319
node ui-studio/server.mjs --port 4320 --project D:/repos/AshenSpire
```

Without the server the page still runs from any static server (open
`ui-studio/index.html` through `npx serve .`): it reads the config files
relative to itself, keeps drafts in the browser, and saves by **downloading**
JSON. Writing into the checkout, validating with the compiler, the live game
frame and sketch files need the server.

## Modes

| Mode | What it edits | Canvas |
| --- | --- | --- |
| **Config** | one `content/config/ui/*.json` file, chosen by wireframe | the file drawn as regions at the chosen device size; drag a band edge or a dashed edge, click a region to edit its numbers, or edit any value under **Values** |
| **Sketch** | a sketch document (`ui-studio/workspace/sketches/*.json`) | free boxes: draw, move, resize with grips, marquee-select, align, reorder, lock, hide; a box may carry an override per breakpoint |
| **Compare** | nothing | the current wireframe (and sketch) at every enabled device, both orientations for phones and tablets, each with the game's layout mode and zoom |
| **Live game** | nothing | the real game at the device size, opened on the wireframe's `?shot=` fixture; reads saved and compiled config only |

Every device shows the **game's own layout decision** — `wide`, `narrow`,
`short-wide` or `short` and the zoom — computed with the same rule as
`src/main.js` (`balance.ui.uiScale`, read live by the server). A device that
would raise the upright gate says so.

## Grid and snapping

Settings → Grid, or the toggles above the canvas (`G` grid, `S` snap):

- grid step in device px and its subdivisions; snap distance in screen px;
- snap targets: the grid, the viewport's edges and centre, the safe-area
  insets, and other boxes' edges and centres (guides draw as pink lines while
  you drag; hold `Alt` to drag free);
- band step: config drags round band percentages and fractions to this;
- nudge sizes for the arrow keys (`Shift` for the large step).

Bands always sum to 100: moving one edge gives the slack to its neighbour, the
same rule `tools/config-build.mjs` enforces.

## Devices, orientations, breakpoints

Settings → Devices is the preset table: desktop, tablet and phone sizes in CSS
px (what the game sees), safe-area insets, on/off for Compare, plus a
**Responsive** entry whose width and height you type in the top bar. Add,
duplicate, remove or reset presets; everything is stored in
`ui-studio/workspace/settings.json` (or the browser without the server).
**Rotate** turns a device; double-click it to return to automatic orientation.

Breakpoints are named width/height ranges. The defaults follow the game's own
modes (narrow at or below `narrowMax`, compact below the 768 px token, wide
above). A sketch box edited with *Edits go to: this breakpoint only* keeps its
base geometry at every other size; a purple outline marks a box with an
override, and the inspector can reset it to base.

## Values, variables, fractions

Every value in the file is editable under **Values**, grouped by section, with
the unit read from its name (`…Px`, `…Rem`, `…Vw`, `…Vh`, `…Ms`, `…Fraction`)
and a filter box. A `$name` reference shows a picker of the file's `vars` and
`ui/tokens.json`, with `#` to replace it by its number; a fraction edits as
`numerator / denominator`; a list as comma-separated JSON. **Edit as JSON**
opens the whole file; **+ Add value** adds a new path in one of the six
sections. Changed values are marked; a per-file **revert** is under Save.

## Save

**Save** (Ctrl+S) validates the whole tree with `compileEntries` from
`tools/config-build.mjs` — the same refusals the build raises, by file and
rule — then writes only the files that changed, keeps their previous bytes
under `ui-studio/.state/<checkout>/backups/`, and checks each file's expected
hash so a draft cannot overwrite work another task did on disk. Saved JSON
keeps the house style: an unchanged subtree keeps its bytes, so a band change
is a one-line diff. With *run tools/config-build.mjs after saving* on, the
generated module is refreshed and the live game sees the change; commit the
JSON and `src/config/generated/ui.js` together, as `content/config/README.md`
asks. Backups can be staged back as edits for review.

## Files

```
ui-studio/
  index.html, studio.css      the page
  app.mjs                     state, panels, pointer and keyboard handling
  canvas.mjs                  the wireframe as SVG (pure)
  model.mjs                   settings, devices, layout rule, snapping, bands,
                              regions, sketches, formatter, history (pure)
  server.mjs                  local server: config read/validate/save, compile,
                              settings, sketches, game preview
  workspace/settings.json     your settings (written on first change)
  workspace/sketches/*.json   saved sketches (ashenspire.ui-sketch/1)
  tests/*.test.mjs            node --test ui-studio/tests/*.test.mjs
  tests/browser.mjs           node ui-studio/tests/browser.mjs (needs Playwright;
                              UI_STUDIO_PLAYWRIGHT, CHROME_PATH, UI_STUDIO_EVIDENCE)
```

The server listens on 127.0.0.1 only; the API needs a per-process token and an
exact origin; the game preview is served on the separate `localhost` origin
under a sandbox CSP so a page inside the frame cannot reach the file API;
paths are checked for traversal, hidden segments and symlinks.

## Sketch JSON

```json
{
  "schema": "ashenspire.ui-sketch/1",
  "name": "Combat, phone",
  "unit": "percent",
  "breakpoints": [{ "id": "narrow", "label": "Narrow (phone)", "maxWidth": 520 }, { "id": "wide", "label": "Wide", "minWidth": 768 }],
  "boxes": [
    { "id": "hand", "label": "Hand", "x": 5, "y": 70, "w": 90, "h": 25, "layer": 0, "locked": false, "hidden": false,
      "overrides": { "narrow": { "x": 0, "w": 100, "h": 30 } } }
  ]
}
```

`unit` is `percent` of the viewport (responsive by construction) or `px`.

## Suggested next features, in order of usefulness

1. **Bind a sketch box to a config path.** A box whose height writes
   `sizing.bands.context`, or whose width writes `sizing.portraitSlot.widthVw`,
   would turn a sketch into a config edit without a second tool. The region
   model already maps config → rectangles; this is the reverse arrow.
2. **Ghost the real screen behind the wireframe.** A screenshot of the live
   frame (or the frame itself at low opacity) under the regions, so a band
   edge is dragged against the art it will cut. `tools/ui-sweep.mjs` already
   photographs every room at both widths; reuse its fixtures.
3. **Measured versus nominal.** The canvas draws authored numbers. Reading the
   live frame's `getBoundingClientRect` for the same regions (the hand, the
   footer, the map header) and drawing the difference would show where a
   minimum or a clamp wins over the percent.
4. **Per-breakpoint config values.** `bandsCompact` is the only compact
   override today. A convention such as `sizing.bands@narrow` in the JSON,
   resolved by the compiler, would let every number vary by breakpoint and
   the studio would edit it in place (the sketch overrides already model it).
5. **Contract checks in the studio.** Draw the W4 minimums (footer 56 px,
   44 px targets) and the approved-wireframe allocation tables from
   `docs/architecture-handoff/COMPONENT-SIZING.md` as reference overlays, and
   flag a region that falls below them at a device — the footer note is the
   first of these.
6. **Design tokens as a palette.** Tokens are edited as a file today; a
   palette with "used by n values" and rename-across-files would make them the
   place shared numbers actually go.
7. **Export a contact sheet.** Compare as one PNG (every device, every
   orientation) for a pull request's screenshot line in CONTRIBUTING.md.
8. **Layer and motion timelines.** `layering.layers` (z order, enabled) and
   `motion.entrance` steps are edited as values; a layer stack with drag
   reorder and an entrance timeline would fit the scene files.
9. **Spire Studio plugin.** Register the studio in `editor/workspace/plugins.json`
   once the editor's preview origin can host a tool that needs its own server
   (today the editor serves only files under `assets|art|docs|src|styles|content`).
10. **Acceptance run in CI.** `tests/browser.mjs` drives the page in headless
    Chromium (drag, undo, validate, compare, sketch, live game); it needs
    Playwright, so it is a hand-run today, like the game's other browser
    checks, until the repository's workflow runs on push again.
