# Simple card art composition

Simple artwork now renders the approved revision-14 cutouts as independent PNG layers. Card frames, titles, rules, combat definitions and Legacy artwork are unchanged. Full cards and deck-editor thumbnails use the same composition resolver.

## Authoring and runtime data

Edit `asset-data/card-art/layered-selection.json` to choose approved composition codes for combat identities. Run:

```
node tools/export-layered-card-art.mjs
node tools/export-layered-card-art.mjs --check
```

The exporter selects 28 compositions and 44 component PNGs from `docs/design/new-card-art/cutout-manifest.json`, verifies their hashes, and copies them unchanged into `assets-display/card-cutouts/`. It writes the readable `asset-data/card-art/layered-runtime.json` and its synchronous browser-module twin, `src/content/layeredCardArt.generated.js`. The full proposal library stays separate from the runtime subset.

Each JSON asset includes its PNG reference, dimensions, hash, source references, anchors and default transform. Each composition layer includes numeric position, size, rotation, opacity, scale, resolved affine matrix, CSS, z-order and any scepter attachment. Geometry is resolved with the proposal viewer's shared layer math at export time. No image is flattened or recolored. Zero is a real choice: `Y00` means the blue sword on the amber scepter.

| Resolved identity | Runtime art |
| --- | --- |
| Physical Attack | O00 sword |
| Physical Smash | O11 hammer |
| Physical Sweep | L40 scythe |
| Physical Defend | O44 shield, secondary sword hidden |
| Physical Counter | O44 shield and separate sword |
| Spell melee Attack / Smash / Sweep / Defend | Y00 / Y01 / Y02 / Y04, or their pale mint equivalents |
| Spell Attack with projectile/ranged delivery | Z00–Z09; elemental projectile plus separate amber scepter |
| Utility removing a status from self | H00 cleansing fire |
| Utility draw / retain / reshuffle | F00 cards |
| Utility heal | G00 leaf |
| Other spell utility | I00 spellbook |

All ten approved ethereal weapon/color combinations remain in the runtime JSON, including the scimitar. The melee mapping can select any of the five digit choices without regenerating art. Earth, alteration, necrotic and wind choose pale mint; the other schools use blue. All ten element projectiles are supported. Spell Counter and Evade retain the prior Simple bases until a matching cutout assembly is approved. Other unsupported identities retain Legacy; this pass does not invent additional status, power or consumable object art.

## Selection and rendering

`simpleCardArt(def, {ref, registries, large, variant})` accepts an already-resolved definition. Identity follows `cardTags ?? tags ?? activeRegistryJunction`. Explicit empty tags are authoritative. Conflicting camps/maneuvers fall back; names and profile IDs never guess a weapon. Cast skills/powers use utility objects; explicit maneuvers still take precedence. A legacy Attack type with an authored camp and no explicit maneuver remains Attack. An evade payload or direct `dodgeRoll` selects Evade; a block effect alone does not.

Elements resolve from `element:`, then `school:`, then a single authored damage identity. Mixed damage does not imply an element. Presentation aliases remain `alternation → alteration`, `illusion → psychic`, `decay → necrotic`, `cold → frost`, `holy/sacred → divine`, and `arcane → force`. Unknown magical schools use force. These themes introduce no combat schools or mechanics.

The result retains `kind: 'simple'`, `path`, `fit`, `position`, `category`, `maneuver`, `element`, `statuses` and `layers`, and adds `componentArt` when an approved assembly exists. `path` is its background PNG. `cardArtLayersHtml` renders the remaining cutouts in a uniformly scaled 512×640 stage, centered inside the clipped artwork well. Backgrounds cover the well; the stage fits inside it, preserving the weapon axis at every aspect ratio. All layers are decorative and ignore pointer input.

Each melee projection uses `V.object.0`, exactly 152.95×152.95 in composition space, on its approved shaft axis. The foreground weapon stays separate; blue opacity is 0.4 and pale mint is 0.2. Existing element/status perimeter accents remain until dedicated status PNGs are approved. An action plus its element and at most two statuses uses at most four visual identities; unthemed physical actions may show three statuses. Statuses remain registry-scoped, deduplicated, deterministic and presentation-only.

If the background **or any cutout** fails, the whole assembly falls back to retained art, then outlines. Removing all overlays prevents orphaned glow/scepter layers. Switching Display → Card artwork refreshes mounted cards and deck thumbnails. Existing 1–5 variant overrides apply to retained flat bases; approved physical objects remain stable across cards.

## Packaging and verification

The existing branch-owned art path adds the hash-verified PNGs to the common pack through `tools/card-cutout-assets.mjs`; both light and high builds share the same cutouts. The portable build inlines the same bytes through `cardCutoutUrl`, while web builds resolve them through `assetUrl`. Neither build depends on hosting proposal pages or fetching the runtime JSON asynchronously. The pinned external art release remains unchanged.

The [runtime preview](preview/layered-card-art/index.html) exercises production card rendering and shows all ten ethereal assemblies. Tests cover selection, real cleansing/healing cards, strict tag precedence, transform fidelity, common-pack membership, status limits and component failure. Browser captures cover desktop, mobile, wide and tablet; the preview also checks Simple/Legacy switching and a deliberately failed component.
