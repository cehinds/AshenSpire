# AshenSpire engraved interface kit

Open `index.html` to review 79 icons and 50 SVG interface pieces. This is a reusable visual asset collection for the desktop and mobile concept boards. No gameplay values, names, descriptions or numbers are baked into the SVGs. Text and actual state belong in the live UI. `manifest.json` records each asset, its dimensions and applicable slice insets. `generate-ui-kit.py` is the deterministic authoring source.

## Visual language

Use a calm soot backing, warm ivory information and restrained worn brass edges. Fine angular engravings distinguish this family from rounded application icons. Keep rich painted scenery and item illustrations underneath clear frames. Thin ornamental lines are decorative; the larger identifying icon strokes remain readable at 24 pixels. Use 24–32 pixels for normal icons and 16 pixels only for secondary inline cues with a visible text label.

The neutral icon exports use brass `currentColor` with a fallback `color` attribute on the SVG root. To recolor an inline instance, apply `color` CSS directly to that SVG root, or remove its fallback attribute so it inherits the parent color. An SVG loaded through `<img>` is its own document and keeps the fallback brass; use an inline SVG, CSS mask or exported recolored variant when the authoritative semantic palette must change it. Repeated inline copies need unique per-instance title IDs and matching `aria-labelledby` values; do not paste the same title ID twice. Decorative icons inside an already named control should use `aria-hidden="true"` and omit redundant title labeling. The resource fill exports use the current registered default semantic hues as stand-alone review samples. At integration, generate their color from the authoritative theme instead of introducing a second palette registry. `theme.css` is an example adapter, not a replacement theme.

## Components and slices

- Folio panels, HUD strips and item slots: the manifest supplies 24- or 20-pixel caps. Stretch the center using CSS `border-image` with `fill`; preserve the corners. Do not scale a whole rectangular border to a different aspect ratio.
- Button exports are 280 × 56. Use `border-image: url(...) 16 24 fill stretch`, reserve those caps, and keep the text as a separate DOM element. For long labels, expand the control or wrap suitable body copy; do not shrink essential text.
- Card frames use a 240 × 336 canonical aspect ratio. Artwork fits the transparent aperture `[10, 10, 220, 180]`. The manifest gives live title, type and body areas. This card frame should preserve its aspect ratio; for large inspection layouts use a separate folio panel around artwork and live text, rather than vertically stretching the whole card. The parchment label is optional and uses dark readable text.
- Meter tracks and fills are separate assets. Clamp live fractions to `[0, 1]`, crop/clip a full-width fill, and overlay live numeric values outside or above it. The eight-cell strip is a decorative example; compose the actual cell count when game rules require discrete cells. It does not introduce a maximum.
- The six route nodes encode distinct reachable, visited, selected, current, unknown and locked appearance using outlines and symbols. Compose encounter icons into reachable/selected nodes from canonical map data. A selected node is not automatically travelable.
- `corner-engraved.svg` is a top-left corner. Rotate 90/180/270 degrees for the others. Stretch dividers without scaling ornament ends; plain separators work best in dense mobile trays.
- Toggle and slider pieces only provide visual skins. Use real accessible controls for semantics, focus, keyboard changes and settings persistence. The bottom-tray handle is decorative and must not imply drag behavior that is absent. The included mobile-tray SVG embeds a top-center handle which stretches if the whole center edge is sliced; use the ordinary panel-backed skin with a separate fixed-width CSS handle to preserve shape across tray widths.

## Desktop and mobile

Desktop may show the item list, detail and comparison together. Portrait mobile uses one open detail tray, 2-column card/inventory layouts where readable, and one reachable primary footer action. Use the same vector source on both; enlarge the interaction box independently of the illustration. Every interactive target should meet the game's configured tap-size setting (current default 44 CSS pixels of hit area), and preserve player text-size settings. Give short landscape phones a scrollable tray and avoid fixed stacks that conceal the field. Do not uniformly shrink a desktop layout.

Keep panel centers opaque enough for labels over scenery. The kit does not validate every screenshot size or guarantee contrast of unknown underlying art. Verify actual text, theme overrides and scaled hit regions after runtime integration.

## State meanings

Keep state, role and domain legality separate. Neutral utilities and unavailable actions use brown/brass. Persistent category/item selection uses gold and a marker. Ready primary actions receive a restrained green edge; focus increases emphasis and adds a visible ivory outline. Exit/back/close receive red while highlighted. Explicit destructive commits receive red when actionable. Disabled controls retain readable labels and a clear explanation; avoid simply fading the entire surface.

Preserve the Combat End Turn exception: neutral when an early end is legal but actions remain, green when legal and actions are exhausted or the legal control is highlighted. Never map End Turn to the generated red boss button. Resource and status hues keep their registered semantic meaning. A card becoming playable must not recolor every keyword or resource icon green.

Focus and selected markers should remain separate layers so input focus and persistent selection can be shown together. An SVG skin is never evidence that a command is affordable or legal.

## Grounding and scope

The kit was grounded in the combat, deck and settings preview boards, their review notes, the shared interaction contract, shipped theme defaults and `src/content/statuses.js`. Icons include the common canonical resource/status families and player surface navigation. `blight` maps to the canonical `crimsonBlight` status; `actions` maps to the engine's `energy` resource. There are no hypothetical Materials or trinket-slot additions. Uncommon class-specific status artwork retains its existing canonical symbol until authored; no speculative semantic replacement is assigned here.

This collection is first-party original SVG geometry produced for the requested concept kit. It includes no external icon pack, font outlines, raster embeds or third-party dependencies. Runtime integration, localization, accessibility verification and live theme adapters remain separate work.

## Review

All SVG files are parsed as XML during generation. The contact sheet displays 24-pixel native icon samples and component previews, supports type filtering and name search, and links the individual vector files. The source script can be rerun without a network connection.

`icons-contact-sheet.png` and `components-contact-sheet.png` were rendered from every SVG through Sharp and visually inspected. The icon sheet includes both 24- and 48-pixel samples. `render-review.cjs` records that review render, using the preinstalled workspace Sharp dependency. Browser UI verification was unavailable in the asset-authoring child agent; a parent review can open the HTML contact sheet.
