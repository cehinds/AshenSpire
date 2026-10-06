# Alternative combat build

- Branch: `codex/combat-studio-alternative`
- Base: `80015a879` (the approved card typography checkout).
- Scope: Combat Studio authoring build, layered combat artwork, rear-view hero
  sprites, independent desktop/phone layouts, UI component editing, local
  background library, and configurable outline/glow previews.
- The current HUD, cards and footer are rendered from the game in screenshot
  mode. Saved layouts and effect triggers are authoring data; this branch does
  not yet bind them to live combat gameplay.

## Run locally

From the repository root, with Python installed:

```powershell
python docs/design/combat-depth-2026-10-05/serve-preview.py
```

- [Combat Studio](http://127.0.0.1:4189/docs/design/combat-depth-2026-10-05/editor/battlefield-wireframe-editor.html)
- [Combat composition preview](http://127.0.0.1:4189/docs/design/combat-depth-2026-10-05/game-preview.html)
- [Art collection](http://127.0.0.1:4189/docs/design/combat-depth-2026-10-05/index.html)

The server uses the checkout's tracked light artwork. Optional music/SFX packs
are absent in this checkout and are not required by the visual editor.

## Saved layouts and validation

- Save/autosave keeps browser-local drafts. Export layouts creates JSON with
  both device profiles; import restores it. Browser drafts are not Git commits.
- `combat-depth-2026-10-05/editor/starting-layout-v2.json` contains the supplied
  defaults; old Battlefield v1 layouts can be imported.
- `combat-depth-2026-10-05/HOW-TO.txt` describes the editor controls.
- `combat-depth-2026-10-05/review/studio-report.json` records successful browser
  checks, with desktop/phone screenshots in the same directory.
- `node docs/design/combat-depth-2026-10-05/verify-studio-model.mjs` checks sizing,
  snapping, validation, independent profiles, and legacy import.
- Browser verification scripts use the local Playwright installation documented
  in their source. No CI or production deployment is implied by these local checks.

## Rebuild the download

```powershell
python docs/design/combat-depth-2026-10-05/pack.py
```

The generated ZIP is excluded from Git because of its size. Its source artwork,
editor, reports, and packaging script are tracked on this alternative branch.
