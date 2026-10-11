# HUD Component Studio

From this directory, run `python -m http.server 8360 --bind 127.0.0.1` and open http://localhost:8360/. On Windows, `./start-preview.ps1` starts the same local-only server in the background; `./start-preview.ps1 -Port 8361` chooses a different port. Python 3 is the only preview dependency. Serve the whole folder: opening `index.html` directly cannot load the scene JSON reliably.

## Mouse workflow

- Choose Idle, Player selected, or Enemy selected.
- Choose a form factor: Mobile (default), Tablet, Desktop or Widescreen. The Inspector scope label names the active one.
- Click artwork or text on the canvas, or select any component in the searchable Layers panel. Right-click the canvas to choose between overlapping components.
- Drag to move. Drag selection handles to resize. Select a group in Layers to resize its children together.
- Use the Inspector to change color, opacity, text, dimensions, rotation, layer order, shadows and text backing. Image tint has a clear button to restore original colors.
- Use layer eyes to hide/show and locks to protect components. Hidden elements remain available in Layers.
- Pan and zoom with the toolbar; Fit restores the complete canvas.
- Mobile edits affect the current view. Enable Edit all views when a Mobile visual change should apply throughout. Rename, reparent and deletion change the shared component structure. Undo reverses mistakes.
- Export JSON to save or share the editable layout. Import JSON restores an exported layout. Keep this folder and its assets with the layout.
- Export PNG provides the current view or a transparent selected component. Group exports include children, and shadows and text backing are included.

Edits autosave in this browser at this localhost address. JSON export is the durable backup; browser storage may be cleared. These authoring edits do not automatically change the game or push changes to Git.

## Form factors

The viewbar toggles **Mobile / Tablet / Desktop / Widescreen**. Each form factor keeps its own overrides, applied after the view's overrides:

effective = base ⊕ view (`states[view]`) ⊕ form factor (`formFactors[ff]`)

- **Mobile** keeps the original behavior: edits go to the base or the current view, depending on Edit all views.
- **Tablet, Desktop, Widescreen** write `formFactors[ff]`. Those edits apply in every view and leave Mobile untouched. The Edit all views checkbox is disabled for these, because they are already shared across views.
- **Reset ▾ → Reset form factor** clears the current form factor's overrides on every component, after a confirmation. Undo reverses it.
- Undo, autosave, and Import/Export JSON all carry `formFactors`.

## Shadows and text backing

- **Text shadow** (text nodes): X, Y, blur, color. Rendered as an SVG filter. Blur follows the CSS convention, so the filter's standard deviation is blur / 2.
- **Text backing** (text nodes): color, pad X, pad Y, radius. A rounded rectangle drawn behind the measured text block. Use a dark, semi-transparent color for readability.
- **Widget shadow** (rect, ellipse, image, group): X, Y, blur, spread, color. Applies to the node's painted shape, so transparent images cast a shadow of their alpha.

Each effect has a **Clear** button that turns it off (stored as `null`). Editing any field turns it back on. Values are design px on the 512-wide canvas.

## CSS token export

The studio writes the HUD's tunable look as the CSS custom properties in [docs/hud-layout-tokens.md](../../docs/hud-layout-tokens.md). That document is the contract: token names, types, file format and the form factor table. Follow it when you change a token.

1. Pick a form factor and edit it, or edit Mobile.
2. **Export CSS JSON ▾ → This form factor** downloads `<ff>.json`. **All four (separate files)** downloads `mobile.json`, `tablet.json`, `desktop.json` and `widescreen.json`. The format is `ashenspire-hud-layout/1`, and each file sets only the tokens it overrides.
3. Run `node tools/hud-layout-css.mjs --merge ~/Downloads/<ff>.json …` from the repository root, then rebuild. `--merge` validates every file and merges it into `content/hud-layout/<ff>.json`: exported values win, and tokens the export does not carry keep their tuned values. A refused file writes nothing. The studio only writes the files; it never edits the game's content.
4. **Import CSS JSON** reads such a file back. Geometry tokens become offsets for the file's form factor, and style tokens become node properties where the mapping is one to one. Undo reverses the import.

`css-bindings.json` maps every contract token to one source: a node and an axis for geometry (`px`), or a node and property path for style. The pure mapping lives in `css-export.js`, which the page loads with a script tag and Node can `require`.

- **Geometry** (`--hud-player-details-dx/dy`, `--hud-enemy-nameplate-dy`, `--hud-turn-ribbon-dy`, `--hud-tools-dy`): the node's offset from its seed position, multiplied by 390 / 512 and rounded to whole px.
- **Style** (shadows, backing, fills, strokes, font, sizes): read from the node's properties and converted from design px by 390 / 512. Colors, fonts and keywords are copied as written.
- **Export-only settings**, set in the Inspector under *CSS token export*: `minWidth` on Expanded selected player details (`--hud-details-min-width`), `maxWidth` on the header HP track (`--hud-header-hp-max-width`, px or `none`), and `span` on the Combat log row (`--hud-tools-span`, Card band or Whole field). They have no visual effect in the studio.
- A token is written only when its value differs from the untouched seed (`scene.json`), or when an export-settings value was set in the Inspector. An untouched studio exports `{}` for every form factor, so the game keeps its tuned values.

## Verification

`node qa/verify.mjs` checks the scene graph, every copied asset checksum, the CSS bindings against the contract (each token bound once, with matching types and existing nodes), the seed export for each form factor, and a synthetic desktop move. For the interaction suite, make Playwright available to Node (for example through `NODE_PATH`) and run `node qa/smoke.mjs` while the preview is running. Set `HUD_STUDIO_URL` for another port and `HUD_STUDIO_BROWSER=msedge` to use installed Edge instead of Playwright Chromium. Set `HUD_STUDIO_ARTIFACTS` to save screenshots and exports outside the checkout, and `HUD_STUDIO_SHOTS` to choose a separate folder for the screenshots. The default QA output under `qa/artifacts/` is ignored.

The scene uses 224 nodes, 38 packaged assets, and three selection views. Source-art differences and substitutions are recorded in `scene-notes.md`; checksums and source repositories/releases are recorded in `assets.manifest.json`. See `qa/verification.md` for the publication check results.

## Multi-page design projects

Open `index.html?project=projects/character-creation/scene.json` from this same studio server. Project paths must remain under `projects/<name>/`; asset files are resolved relative to the selected JSON file, so `assets/frame.png` means `projects/<name>/assets/frame.png`. Each project has its own browser autosave. A missing or rejected project displays an error and never opens the HUD draft instead.

The data contract remains scene `version: 1`: `title`, `canvas`, `defaultState`, `states: [{id, name}]`, `assets`, and `nodes`. States are named design pages, not gameplay navigation. Shared nodes appear on every page; page groups can set base `visible: false` with `states[pageId].visible: true`. Keep labels as independent `type: "text"` nodes so they remain editable. An optional `metadata.references` object maps page IDs to `assets/` image paths; it enables the Reference overlay. HUD CSS token export and device overrides are hidden for design projects.

Enable **Snap** to align movement to an 8 px grid, canvas edges/centres, and visible component edges/centres. Pink guides show the chosen alignment. Hold **Ctrl/Command** while dragging to bypass snapping. The round grip above a selection rotates it; hold **Shift** for 15° increments. Resize handles scale groups and their children. **Outlines** helps inspect the component geometry.

**Export JSON** embeds project raster assets in the downloaded file, keeping labels, transforms, groups and every page editable when the file is imported at another studio address. Original files stay untouched. Reference images are review aids and are excluded from the portable export. **Export PNG → Selected component** exports transparent individual layers or groups; **Full view PNG** exports the current page.

Additional checks: `node --test qa/project.test.mjs` and `node qa/project-smoke.mjs` against the running studio. The latter uses routed test scenes and exercises real mouse snapping, bypass, rotation, page text editing, persistence isolation, file roundtrip and PNG export. Set `HUD_STUDIO_EXECUTABLE=/path/to/chromium` to use an installed browser for either interaction suite.

## Single-file handoff

Build with `node tools/hud-component-studio/bundle-project.mjs --scene projects/character-creation/scene.json --out /path/to/Character-Creation-Studio.html`. Double-click the output HTML to use this same editor without a server, installation or network. It embeds the scene, PNG assets, scripts, styles and any local CSS font dependencies. Reference overlays are omitted. Export JSON remains the durable editable backup; bundled drafts save only scene changes and reuse the embedded source images to stay within browser storage limits. `--id <name>` sets the stable autosave identity when distributing renamed copies of one project.

Run `node tools/hud-component-studio/qa/bundle-smoke.mjs` to check direct `file://` opening, safe embedded text, mouse editing, persistence, PNG and portable JSON exports with no external requests. Use `HUD_STUDIO_EXECUTABLE` when needed to select a browser that supports local files.

If the test machine blocks local-file browsing, set `HUD_STUDIO_BUNDLE_URL=http://127.0.0.1:8361/standalone.html` to test the same generated HTML through one intercepted HTTP response; the test blocks every external asset/script request.
