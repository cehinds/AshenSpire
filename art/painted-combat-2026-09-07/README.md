# Painted character art preview

Prepared 2026-09-07 on `codex/painted-combat-frames`.

The current request separates character presentation from combat animation. Keep the previously approved artwork, including the close-up portraits. Character menu and detail poses may face the viewer. Combat uses a small set of poses directed toward screen right.

## Contents

All four classes have their base outfit and three alternatives: 16 outfits total.

- `menu/<outfit>/stand.png` and `detail.png`: 32 full-body presentation images, 640 x 800.
- `menu/<outfit>/portrait.png`: 16 matching close-ups, 512 x 512.
- `combat/<outfit>/`: seven 640 x 640 RGBA state files per outfit, 112 files total: idle, guard, attack1, attack2, attack3, attack4, hit.
- `manifest.json`: image paths, source sheet and pose, content bounds, and the common combat anchor [320, 600].
- `library.json`: 43 retained source sheets, including older poses outside the compact combat set and the facing corrections. No source art is replaced by its corrected derivative.
- `inspection/`: browser contact sheets, phone screenshot, automated results and visual review notes.

Rogue, Reaver and Starseer share their guard drawing with combat idle: six distinct combat drawings mapped to seven states. Herald has a separate idle drawing. Menu artwork never substitutes for a frontal combat pose. The four attack frames show anticipation, extension, contact and recovery; they are a compact keyframe sequence, not a promise of a fully in-betweened animation.

## Review and rebuild

From this worktree root:

```powershell
node art/painted-combat-2026-09-07/serve.mjs
```

Each class now has one complete page containing all four outfits, their menu/detail poses, portraits, combat poses and every retained source sheet:

- Reaver: <http://127.0.0.1:4276/reaver.html>
- Rogue: <http://127.0.0.1:4276/rogue.html>
- Starseer: <http://127.0.0.1:4276/starseer.html>
- Herald: <http://127.0.0.1:4276/herald.html>

The comparison tools and animation player remain at <http://127.0.0.1:4276/>. Playback supports pause, frame stepping and slower speeds. Rebuild just the class pages with `node art/painted-combat-2026-09-07/build-pages.mjs`; the full asset build also regenerates them.

```powershell
node art/painted-combat-2026-09-07/build.mjs
```

The build uses this repository's `tools/painted-poses.mjs` and `tools/concept-cutout.mjs` to extract, align and export the images. Intermediate extraction directories are ignored. An optional outfit ID limits the rebuild, for example `node art/painted-combat-2026-09-07/build.mjs rogue-duelist`.

With the preview server running and Playwright available:

```powershell
$env:NODE_PATH = 'C:/Users/suprbludude/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'
node art/painted-combat-2026-09-07/inspect.mjs
```

The checker verifies the 112 combat files, dimensions, margins, baseline alignment, menu files, browser frame decoding and phone overflow. Facing direction and drawing quality require visual inspection; passing the checker alone does not establish either.

## Provenance and status

New paintings were generated with built-in `image_gen`, using the owner's attached armor and pose references. `generation-record.json` and `duelist-correction-record.json` record the latest prompts and output paths. `prompts.json` records the earlier expanded-frame proposal, which the compact scope in `requirements.json` supersedes. Original sheets are preserved in `reference-library/`, `sheets/`, `menu-sheets/` and `combat-sheets/`.

This is an inspected local art preview. It is not installed in the game, published, or merged into dev. Game integration and the draft PR remain pending. Integration needs to account for the UI changes in the separate "Fix Armoury accordion folds" task, which reported idle on the last direct status read. No gameplay or shared UI files were changed here. Standalone preview validation is recorded; game CI and in-game validation have not been run for this package.
