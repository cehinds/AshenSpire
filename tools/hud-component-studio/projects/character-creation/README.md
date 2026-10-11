# AshenSpire character creation — layered concept

Open the existing editor with `?project=projects/character-creation/scene.json`.

Desktop canvas: 1440 × 900. Seven views: Class → Attributes → Keepsake → Equipment → Feats → Spells → Review. `scene-noncaster.json` is the six-view Reaver variant, with Spells structurally removed. These are design studies: no gameplay, feat budget, or runtime eligibility changes.

All text is independently editable. Each panel/button has a soot material background and brass trim. Each feat emblem has a shared medallion background, hollow trim, separate symbol, and props where relevant. Card art, trim, rank badge, cost, and rules text remain independent. Every node/group supports the existing editor's move, scale, snap, rotation, layer order and text controls.

Generated page illustrations are visual targets in `assets/reference-*.png`. Their hidden layers were not recovered. Independent layers are reconstructed from the existing kit and separately generated transparent symbols. `provenance.json` records source, crop bounds, and transformations. `exports/feat-layer-exploded.png` shows the decomposition.

Run `node tools/hud-component-studio/projects/character-creation/render.mjs` to regenerate all seven artwork exports and seven wireframes. Requires Playwright and Chromium; `CHROMIUM_PATH` overrides `/usr/bin/chromium`. The JSON scene is the canonical editable source. The extraction script records isolated atlas crop operations; do not rerun it over an edited scene.

See `docs/design/character-creation/README.md` and `current-ui-audit.md` for observations and design scope. This pass includes desktop concepts; phone evidence is from the current UI audit.
