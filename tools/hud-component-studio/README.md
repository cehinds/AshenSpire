# HUD Component Studio

From this directory, run `python -m http.server 8360 --bind 127.0.0.1` and open http://localhost:8360/. On Windows, `./start-preview.ps1` starts the same local-only server in the background; `./start-preview.ps1 -Port 8361` chooses a different port. Python 3 is the only preview dependency. Serve the whole folder: opening `index.html` directly cannot load the scene JSON reliably.

## Mouse workflow

- Choose Idle, Player selected, or Enemy selected.
- Click artwork or text on the canvas, or select any component in the searchable Layers panel. Right-click the canvas to choose between overlapping components.
- Drag to move. Drag selection handles to resize. Select a group in Layers to resize its children together.
- Use the Inspector to change color, opacity, text, dimensions, rotation and layer order. Image tint has a clear button to restore original colors.
- Use layer eyes to hide/show and locks to protect components. Hidden elements remain available in Layers.
- Pan and zoom with the toolbar; Fit restores the complete canvas.
- Changes normally affect the current view. Enable Edit all views when a visual change should apply throughout. Rename, reparent and deletion change the shared component structure. Undo reverses mistakes.
- Export JSON to save or share the editable layout. Import JSON restores an exported layout. Keep this folder and its assets with the layout.
- Export PNG provides the current view or a transparent selected component. Group exports include children.

Edits autosave in this browser at this localhost address. JSON export is the durable backup; browser storage may be cleared. These authoring edits do not automatically change the game or push changes to Git.

The editable scene reconstructs the approved three-view composition using source game assets and live text/shapes. The Reference checkbox overlays the original approved illustration for comparison. See `scene-notes.md` and `assets.manifest.json` for asset provenance and reconstruction limits.

## Verification

`node qa/verify.mjs` checks the scene graph and every copied asset checksum. For the interaction suite, make Playwright available to Node (for example through `NODE_PATH`) and run `node qa/smoke.mjs` while the preview is running. Set `HUD_STUDIO_URL` for another port and `HUD_STUDIO_BROWSER=msedge` to use installed Edge instead of Playwright Chromium. Set `HUD_STUDIO_ARTIFACTS` to save screenshots and exports outside the checkout. The default QA output under `qa/artifacts/` is ignored.

The scene uses 224 nodes, 38 packaged assets, and three selection views. Source-art differences and substitutions are recorded in `scene-notes.md`; checksums and source repositories/releases are recorded in `assets.manifest.json`. See `qa/verification.md` for the publication check results.
