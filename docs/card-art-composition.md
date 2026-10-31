# Simple card art composition

## Procedural Simple mode

Simple is the default, including existing saved Simple preferences. Its pure
`proceduralCardArt({type, tags, rank}, {registries})` factory selects only from
the shipped 28 compositions, 44 base PNGs and 108 reviewed PNG/template pool.
It never routes by card ID, name, equipment profile, costs or effects. Semantic
templates are indexed once; a bounded cache uses canonical sorted/deduplicated
tags, type and rank. Returned recipes and their nested transforms are frozen.

An explicit physical/spell camp is required. Maneuver tags override type;
attack, smash, counter, evade, sweep, defend, skill and power are supported,
including defense/evasion aliases. Explicit element wins over school and then
singleton damage tags; existing element aliases and wind are supported.
Cast/projectile delivery selects approved elemental projectiles; explicit melee
retains the ethereal weapon. Counter uses the separate sword and shield; Evade
uses the approved feather. Utility effect tags select healing, draw and cleanse
objects. Status tags select approved PNG marks/glows (a restrained approved
generic cue for other registered statuses). Action plus element and statuses
never exceeds four visual identities.

Ranks 1, 3 and 5 change actual decorative PNG opacity without changing weapon
geometry or recoloring art. Higher ranks retain rank-5 decorative intensity.
Invalid ranks become 1. The definition adapter prefers live resolved rank,
then zero-based abilityRank plus one, before reference rank; abilityRank 0 is
explicitly the first visual rank. This affects presentation only.

`proceduralDefinitionArt` adapts older definitions that lack explicit cardTags:
it can read their declared utility/status effects and attack damage. Explicit
cardTags, including an empty list, suppress this compatibility inference. Thus
new tags-only definitions work and optional unrelated effects cannot alter
their art. Simple resolves before dedicated or curated ID-based art. Reviewed
retains the earlier curated ID snapshots and compatibility formula; Legacy
retains the original illustrations and outline chain. Custom component
appearance overrides still apply afterward. Any failed component abandons
the whole assembly and follows the existing Legacy/outline fallback.

## Applied card-art review

The approved review assigns layered art to all 156 current card IDs without a
dedicated illustration. `asset-data/card-art/reviewed-library.json` is the
editable approval snapshot: it retains the source combat tags, chosen rule,
up to four visual cues, source references and every independent layer transform.
`node tools/export-reviewed-card-art.mjs` compiles it into the runtime module;
`--check` verifies reproducibility. These are approved results of the tag formula,
not new combat rules. New cards still use the live formula below until reviewed.
Rank variants share their approved base artwork.

`playingCardArt` selects these recipes only in Reviewed mode, for reviewed cards
without dedicated art and without equipment profiles. Existing dedicated-art
routing and Legacy mode retain their previous behavior. Approved compositions
already contain their effect PNGs, so the renderer does not add duplicate motifs.
The cutouts include cleansing fire, floating spell projectiles, the earth pebble,
separate counter sword/shield, and status objects with independent marks/glows.
Some status symbols intentionally reuse an existing visual proxy; this does not
alias the corresponding gameplay statuses.

Open [Card art review](card-art-review.html) through `tools/serve.mjs` to see the
checkbox list, standalone art, linked component PNGs and the actual game card.
Position, size, rotation and opacity controls update both previews. JSON export
includes edits and the checklist; PNG export composites the selected artwork.
Changes stay in the browser session until exported. The exported runtime catalog
contains numeric transforms, affine matrices and CSS for each component; the
authoring snapshot remains the reviewed source of truth.
To apply a downloaded placement edit, run
`node tools/export-reviewed-card-art.mjs --import <exported-json-path>`.
The importer preserves component identities and rejects invalid transforms.

The 73 additional PNGs are byte-identical exports of existing proposal assets in
AI-Art. Their original URLs and hashes remain in the source JSON and the art
repository's `provenance/AshenSpire/reviewed-card-cutouts.json`.

## Original general-purpose formula

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
