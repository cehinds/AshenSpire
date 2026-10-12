# AshenSpire character creation — component library

Design study only. No gameplay, feat budget, allocation or eligibility rules changed.

The existing Studio opens each page or reusable component scene. Every scene lives beside `assets/`, so relative PNG paths work in the browser; the library's editable JSON download embeds only the required raster assets. The library can also download an editable standalone Studio HTML file.

`component-manifest.json` is the catalog interface. It contains 26 page scenes across desktop/mobile and caster/noncaster contexts, a hierarchy down to individual image/text/shape layers, and deduplicated reusable definitions. Pixel-identical groups share one definition scene and PNG preview. Original `sourceScene`, `state` and `rootNodeId` identify an instance; `src` identifies the reusable standalone scene and `definitionRootNodeId` identifies its canonical root when different. All component PNGs retain transparency outside their own painted layers.

Desktop geometry is preserved. Each page exposes Header, Navigation, Intro, Content and Footer; panels expose material and trim; fields/buttons expose backgrounds, borders and labels; stat rows expose label/value controls; cards expose artwork, header/cost, body and rank badge. Each feat emblem retains separate background, hollow trim, symbol and relevant props. `component-assign-attribute-row.json` is a reusable label/value/minus/plus example; Standard pages remain read-only.

Mobile is a native 390px reflow, with 16px body text, 48px controls and stacked cards. Default navigation shows the current step plus All steps. The expanded steps grid remains a named hidden group and independently editable component. These are static design presentations; navigation behavior is not implemented in the game.

`scene-mobile.json` contains all seven caster pages. `scene-mobile-noncaster.json` has six Reaver pages: Spells, its navigation item and its Review row are absent, and Feats continues directly to Review. Caster includes classes tagged for spells conceptually; runtime eligibility remains the existing game's responsibility. Starting-feat rules stay undecided.

Full mobile artwork PNGs are exported through the actual Studio PNG exporter. Each page also has a wireframe and a native 390 × 844 viewport preview; `exports/mobile-overview.png` compares the seven caster previews. Full page scenes have individual scroll heights, so the footer remains visible in the complete export. The combined mobile scene uses the tallest page canvas for compatibility with the existing fixed-canvas editor.

Regenerate the package from the preserved desktop seeds:

1. `python tools/hud-component-studio/projects/character-creation/build-components.py`
2. `node tools/hud-component-studio/projects/character-creation/render-components.mjs pages`
3. `node tools/hud-component-studio/projects/character-creation/render-components.mjs components`
4. `node tools/hud-component-studio/projects/character-creation/verify-studio-render.mjs`
5. `node tools/hud-component-studio/projects/character-creation/render-overview.mjs`

Requires Playwright and Chromium. Windows paths with spaces are supported; set `CHROMIUM_PATH` or install the Playwright Chromium browser. Raw render/browser QA reports go to the system temporary directory (override with `CHARACTER_QA_DIR`). The renderer uses the Studio's canvas-measured wrapping, waits for PNG decode and supports scale/rotation. For exact rendering of arbitrary edited effects/clipping, use Studio PNG export.

See `docs/design/character-creation/README.md`, `design-qa.md`, `provenance.json` and `SHA256SUMS.txt`. Existing portrait/item/card art is preserved as its real source layer; no hidden portrait layers were invented.
