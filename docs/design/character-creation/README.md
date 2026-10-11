# Character creation concept package

Design study only. This package changes no gameplay, feat budgets, character validation, or runtime assets.

Open the existing HUD Component Studio at `?project=projects/character-creation/scene.json`. Choose a page in the view selector. The seven views follow Class → Attributes → Keepsake → Equipment → Feats → Spells → Review. The Spells view illustrates a caster: omit that page for classes without spells; martial maneuvers stay in Equipment. Starting-feat rules are deliberately undecided.

Each page is an editable group, with nested navigation, header, footer, content panels, choice tiles, and detail panels. Repeated panels and buttons use separate reusable soot material backgrounds and brass trim images; text is a true editable text node. Art, trim, material, symbol, props, selection, and labels can be moved and transformed independently. Layout dimensions are 1440 × 900.

Generated flat illustrations are visual references. They are not recovered layered source files. The component scene is a reconstruction using original kit layers and explicitly isolated generated art. Provenance is recorded in `tools/hud-component-studio/projects/character-creation/provenance.json`.

Each page has an artwork export and a wireframe export in the project's `exports/` folder. Wireframes preserve the real hierarchy and label placement while replacing raster art with outlines. Exported portable scene JSON from the editor embeds the raster assets. PNG source components live in `assets/`; all scene source paths are relative to that folder.

The displayed character, attribute numbers, equipment and selections illustrate layout, not a proposed change to rules. Illustrative keepsake names and copy require product review. Existing gameplay remains the authority.

To render artwork/wireframes, run `node tools/hud-component-studio/projects/character-creation/render.mjs` from the repository root. It uses Playwright and installed Chromium (`CHROMIUM_PATH` overrides `/usr/bin/chromium`).

The [current UI audit](current-ui-audit.md) records fresh desktop/phone observations. Highest priorities were the blank collapsed Equipment entry, duplicated folds/actions, inconsistent opening-hand/capacity labels, cramped card text, and missing dedicated Feats/conditional Spells stages. The concepts address those presentation issues; interaction and accessibility validation remain implementation work.

`scene-noncaster.json` illustrates Reaver with six pages: its Spells page, navigation item, and Review spells row are structurally absent. The Feats continuation goes straight to Review. This is a static design variant, not runtime spell eligibility logic.

`exports/feat-layer-exploded.png` shows the independent reusable background, hollow trim, symbols, and assembled emblem. All six feats share the same background/trim assets, with distinct symbols and separate props. Alpha inspection verified the generated trim and sun-ray centers are empty. The full six-emblem atlas is reference-only; none of its flattened emblems is used as an interactive scene asset.
