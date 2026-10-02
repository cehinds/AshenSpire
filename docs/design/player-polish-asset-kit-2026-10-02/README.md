# AshenSpire player polish asset kit

Open **index.html** for the portable preview and original-file links. The kit contains **16 new raster assets, 129 original SVG assets, 49 unchanged canonical art copies, and 3 existing font copies**. The 24 feature views from all twelve concept boards have desktop and mobile recipes in **feature-map.json**. This versioned kit is a design resource; runtime integration remains separate and gameplay is unchanged.

## Start with the layers

1. Use the selected scene as the world layer. Title, merchant and forge each have independently composed landscape and portrait PNGs. Grave, rest and study are square masters; preserve their focal landmarks in an upper illustration region while live details sit in a separate mobile tray.
2. Place canonical character, enemy, weapon, relic and flask art as separate `object-fit: contain` layers. Preserve source identity and measured outfit/foot/medallion anchors. **canonical-map.json** records every unchanged copy and its hash; use the original runtime asset IDs when wiring them.
3. Place a soot veil behind busy information regions. Add **materials/soot-leather-material.png** inside folio/card surfaces with `background-size: cover; background-repeat: no-repeat`. Its grain is visible enough to require a dark overlay under small labels. It is not claimed to be seamless. Keep it independent of the border and scale it less aggressively on small controls.
4. Overlay the transparent SVG frame, then DOM headings, labels, values and descriptions. Use **ui/components/panel-frame.svg** over the textured surface; **panel-backed.svg** includes an opaque center for readability and can obscure a material below it. Transparent exteriors/apertures do not mean all panel centers are transparent.
5. Keep focus, persistent selection and availability as separate live layers. **ui/theme.css** is an example adapter whose active skins exclude disabled actions. The game decides whether an action is legal. Preserve the existing Combat End Turn exception.

Example material and frame composition (paths relative to this root):

```css
.polish-folio {
  color: var(--player-ivory);
  background:
    linear-gradient(#0d0b08bb, #0d0b08bb),
    url(materials/soot-leather-material.png) center / cover no-repeat;
  border: 24px solid transparent;
  border-image: url(ui/components/panel-frame.svg) 24 fill stretch;
}
```

The root preview demonstrates that recipe with live DOM text and unchanged item art. Decorative generated portraits and card illustrations are optional supplemental visuals. They are not registered NPC identities, exact named cards or new rules. Choose deliberate art bindings through the existing identity/art model instead of assigning them by a broad gameplay tag.

## Desktop and mobile

**Desktop:** reveal context, selection and comparison together where space permits. The merchant/forge panoramas leave calm shadow on the right; their optional portrait cutout belongs on the left. Preserve the illustrated silhouettes and live numeric hierarchy.

**Mobile:** use the separate portrait title/service composition. One open detail tray, readable body text and a reachable bottom action should determine layout. Use the square scene master in a square or 4:3 narrative header when a full-height crop would lose the grave bowl/fire. The manifest records focal positions; these are CSS framing recommendations, not destructive raster crops. The study art can sit behind an opaque inspector. Icons remain 24–32 CSS pixels with at least the game's configured 44 CSS-pixel hit area; grow the control box independently of the art. Keep text-size and reduced-motion preferences.

Use the same scalable vector source for both devices. Nine-slice caps, card apertures, meter clipping, recoloring and repeated-inline-SVG title-ID rules are in **ui/README.md**. The mobile-tray SVG embeds a handle that stretches under center-edge slicing; for arbitrary widths use the ordinary folio backing with a separate fixed-width decorative handle. Never make that handle imply unavailable drag behavior.

## Existing seams and content

**feature-map.json** maps every feature to existing `src/ui/screens` modules, art files and shared parts. The copied regional combat images are **atlases**, not single fight backdrops: continue using `combatEnvironment()` and authored `box`, `floorStart` and floor geometry from `content/config/ui/presentation/environments.json`. The legacy dungeon background and floor are separate images. Do not invent a new camera or combat-ground contract.

Use `assetUrl()` from `src/ui/assetmap.js` and the helpers in `src/ui/assets.js` for tier-aware lookup; `prologueArtwork()` already distinguishes desktop/mobile authored narrative art. Preserve `paintedOutfitArt`, `equipmentArt`, `relicArt` and existing enemy pose/anchor resolution. The kit includes representative assets for reuse, not every equipment item or animation frame. Undiscovered compendium objects should keep canonical silhouettes and hide names/stats according to actual discovery state.

All card effects, costs, resource values, affordability, reward ownership, rest recovery, skill prerequisites and multiplayer readiness must remain sourced from the actual models. The concept boards' invented Dodge effect, deck cap, seconds-based skill, merchant affordability and mount compatibility must not become game data. Cards use DOM text and the actual card model even when a new illustration is selected.

Copy selected new files into the project's established art source/export pipeline, add credits and register tier exports when implementation is authorized. Do not hand-edit the generated art manifest or keep runtime assets only in this authoring folder. This delivery does not switch the live game to these assets.

## Contents and provenance

- **scenes/**: nine newly generated background PNGs, with separate portrait title/merchant/forge compositions.
- **illustrations/**: three transparent generic role portraits and three borderless action/card paintings.
- **materials/**: one text-free dark leather panel material.
- **ui/**: 79 engraved icons, 50 frame/control/meter pieces, standalone preview, manifest and deterministic SVG source.
- **canonical/**: 49 byte-identical source art copies for class figures, maps, environments, equipment, relics, flasks and enemies.
- **fonts/**: existing Cinzel, Cormorant Garamond and Inter files with the source OFL license; their original credits remain applicable.
- **manifest.json**, **generation.json**, **canonical-map.json**: dimensions, hashes, origins, alpha, prompts and references.
- **art-contact-sheet.png**, **desktop-mobile-compositions.png**, **canonical-contact-sheet.png**, and **ui/*-contact-sheet.png**: static review compositions; these are not runtime asset atlases.

New raster art was made with the built-in `image_gen.imagegen` tool; SVG geometry was authored directly. Source PNGs were copied unchanged and cutout alpha preserved. No third-party icon pack or newly downloaded font is included. **CANONICAL-CREDITS.md** and the copied source license apply to existing materials; this kit does not relicense them. New generated illustrations are described as first-party AI-created art without claiming a third-party asset license.

Static art review, manifest/link/hash validation and an independent agent review are recorded in **VALIDATION.md**. Interactive browser checks were unavailable under the app URL policy; do not treat the preview as verified runtime behavior.

## Rebuilding and exporting the kit

The saved previews open without a framework or network dependency. Optional
Python helpers require Pillow 10.1 or newer; review captions use its bundled
default font consistently across operating systems. `verify-package.py` also uses Node for JavaScript
syntax checks. Run them from this folder. They locate this repository from the
kit's checked-in location; set `ASHENSPIRE_REPO` to another checkout when using a
standalone copy. `verify-package.py` verifies delivered asset hashes, dimensions
and references, refreshes `SHA256SUMS.txt`, and writes a ZIP plus checksum beside
the kit. The repository ignores those generated archives.

The paths already recorded in `SHA256SUMS.txt` define the package inventory;
local caches and editor artifacts are excluded. When adding a package file,
add its relative path to that inventory before refreshing hashes. ZIP entries
use fixed timestamps and permissions, so identical package bytes produce the
same archive with the same Python/zlib versions regardless of checkout metadata.

`ui/generate-ui-kit.py` regenerates vector sources using Python's standard
library. `ui/render-review.cjs` renders static sheets using Sharp resolved from
normal Node modules; `ASHENSPIRE_SHARP_MODULE` can name an installed module path.
`package-kit.py` refreshes selected canonical copies, and `build-delivery.py`
rebuilds manifests and review compositions. The original AI generator-output
paths are historical provenance: if that archive is unavailable, helpers report
it and still verify the delivered files against their recorded manifest hashes.
Text files use LF so recorded SVG hashes survive Windows and Linux checkout.
