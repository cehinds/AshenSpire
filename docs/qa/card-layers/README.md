# Card layer explorer and layout editor

Open `/docs/qa/card-layers/index.html#editor` on the existing source-preview server.
The editor uses native card components, with the original wireframe retained in
`wireframe.html`.

- Click a visible component or its name in the list to select it. Drag it to
  move; use any of the eight handles to scale. Keep ratio can be switched off.
- Shift-click adds/removes components from a selection. Clicking a layer name
  selects its parts as a group. The text box, trim, effect text, rank bar and
  rank text are linked by the game JSON's `groups.textBox` definition. Selecting
  any member selects that group; moving/scaling preserves the rank anchor.
- Snap aligns left/center/right and top/center/bottom to other components,
  the card bounds, and the optional 12-unit grid. Cyan guides show an active
  alignment. Hold Alt to bypass snapping during a gesture.
- Drag the grip beside a layer to reorder the front-to-back stack. Its number
  and rendered paint order update immediately. Up/down buttons and arrow keys
  on a focused grip provide equivalent keyboard controls.
- Arrow keys on the canvas nudge a selection by one design unit; Shift nudges
  ten. Escape cancels an active drag or clears the selection. Undo/Redo and
  Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z restore earlier edits.
- Browser drafts are retained per sample. **Save to game** writes the shared
  default to `src/content/card-layout.json`, regenerates the runtime card data,
  and reloads the editor. The next game view uses the saved default for all cards.
- **Export JSON** downloads that same complete document and saves it to the
  game. A failed save is shown explicitly; a downloaded file alone is not a
  successful save. Reset layout restores the current game default in the draft.

The preview and game use the same `version`, `order`, `layouts`,
`coordinateSpace`, `currentCard`, `referenceRects` and `groups` fields.
`layouts.shared` is the default face geometry; existing asset/layer definitions
remain in the document. Rank follows the panel's top edge when effects expand
it; Rank 0 hides its bar and text. The local server must use `--editor-write`.
Saving changes local source data, not deployed builds.
New local PNGs are served from `assets/` while authoring; shipping new artwork
uses the repository's normal art-pack publication and build workflow.
When this server runs with `--editor-write`, direct edits to the master JSON
are also regenerated on the next game refresh. Use the embedded **In-game
preview** or **Open game full size** to check the actual combat hand and card
inspection. **Refresh game preview** reloads the current template.

## Images, symbols and typography

Select a part, then use **Component appearance**. Set an image path under
`assets/`, choose its fit in the appearance JSON, and edit its styles. **Apply
to draft** previews the change; **Save to game** makes it the shared default.
The symbol choices let you change one action or tag identity across all cards.

The master file's `components` map supplies component appearance. For example:

```json
"panel-trim": { "href": "assets/card-components/my-trim.png", "fit": "fill", "style": {} },
"title": { "style": { "color": "#f4e2bb", "fontFamily": "Georgia" }, "text": { "maxFontSize": 33, "minFontSize": 24 } }
```

Use `symbols.actions.smash.href` for a replacement Smash icon and
`symbols.tags.fire.href` for the fire tag. Symbols support a PNG/WebP/SVG path
or inert SVG geometry in `svg`. A component's `href` overrides its existing
image or shape; `null` uses the template image. The original `layers` entries
remain the base geometry and asset bindings; `components` supplies optional
appearance overrides and `layouts.shared` supplies the edited geometry.
`rank-group`, `tag-rail` and `footer-band` expose container styling. Rank bar
bevels are `decorations`, so their colors and shape are editable as well.

Names, costs, rules, rank labels and symbol identities still come from card
definitions and live game state. Text appearance never replaces those bindings.

The isolated component tiles retain source geometry while their layer numbers
follow the current stack. Painted trims/fills remain complementary clipped
regions of shared source images.

## Browser verification

Run `node tools/card-layout-save-qa.mjs` (or the compatibility entry point
`card-layer-editor-qa.mjs`) with `PLAYWRIGHT_MODULE` and `CHROME`. Set
`CARD_EDITOR_OUT` to a D: evidence folder. This creates an isolated copy of the
game JSON and generated data; the user's saved layout is not overwritten.
It verifies grouped move/scale, saving, regeneration, reload, native card
rendering, long-effect anchors, desktop/phone, stale/origin rejection and an
export matching the canonical JSON byte-for-data.

`node tools/card-master-qa.mjs` with `CARD_MASTER_OUT` set to a D: folder checks
component PNG editing and saving, direct master-file regeneration, real combat
rendering with live content bindings, and desktop/phone/inspection screenshots.
