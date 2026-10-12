# Simple card art composition

The approved 60-image library supplies each weapon silhouette. Presentation code combines one base with a quiet elemental glow, fine perimeter marks, and up to three small status details. No card definitions, combat rules, schools, or new paintings are introduced.

`simpleCardArt(def, { ref, registries, large, variant })` accepts an **already resolved** definition and returns either `null` (keep the existing artwork fallback) or `{ path, kind: 'simple', fit, position, category, maneuver, element, variant, filter, statuses, layers }`. A missing definition returns null; refs never override a supplied definition. Render `filter` on the base image, then `cardArtLayersHtml(composition)` inside the same positioned, clipped art well. The overlay is decorative, ignores pointer events, has no animation, and uses no SVG IDs or external resources. On image failure remove `[data-card-art-layers]` with the failed simple image before showing legacy art.

Identity follows `cardTags ?? tags ?? activeRegistryJunction`; an explicit empty array is authoritative. Static authored tags are consulted only when no active registry or resolved tags are supplied. Camp selects physical versus magical. The six visual maneuvers are attack, smash, counter, evade, sweep, defend. Authored casting/ranged actions share the attack visual; an explicit evade payload selects evade. Unknown or conflicting camp/maneuver tags safely fall back. Names and ref/profile IDs never guess identity.

| Element | Base variant | Perimeter detail |
| --- | --- | --- |
| Force | 04, muted blue-violet filter | Incomplete pressure rings |
| Fire | 02 | Sparse embers |
| Lightning | 03 | Fine broken lightning threads |
| Earth | 05, mineral brown filter | Angular stone fragments |
| Frost | 01 | Ice crystals |
| Psychic | 04, rose-violet filter | Paired ripples |
| Alteration | 05, teal filter | Orbital diamond marks |
| Divine | 03, pale gold filter | Halo and rays |
| Necrotic | 05, desaturated green filter | Thin curling wisps |

`element:` tags take precedence over `school:`. Presentation aliases are `alternation → alteration`, `illusion → psychic`, `decay → necrotic`, `cold → frost`, `holy/sacred → divine`, and `arcane → force`. Earth is a supported presentation theme, not a new gameplay school. Unthemed magical cards use force. Physical cards default to steel variant01, with no elemental overlay unless explicitly tagged with an element or recognized school.

All 30 magical bases can use every theme. An integer variant override from1 through5 selects the approved base; invalid overrides use the theme default. The override changes neither the silhouette nor the card's identity. Filters are mild palette adjustments, so the original painting remains visible rather than promising every base looks identical to a newly painted elemental weapon.

Status motifs come from authored `status:` tags and nested `applyStatus`/`buildup` effects, not the target's current combat state. Only statuses present in the active registry are shown. Bespoke conditions include blood drops, frost crystals, sleep/insanity ripples, paralysis sparks, vulnerability fractures, concealment wisps, and protection rings. Every other registry status receives a small star detail using its safely validated tint. Labels and IDs remain data; SVG geometry is fixed and HTML attributes escaped. Status IDs are sorted, deduplicated, and capped at three; recursive effect inspection is cycle-safe and bounded. Layers do not replace the information panel's complete status text.

## Preview fixtures

`cardArtPreviewFixtures()` exports 54 fixtures, one per maneuver × element. Each row contains `{ id, title, def, composition }`. Group rows by `composition.maneuver`, put elements in columns, and render each base plus `cardArtLayersHtml(row.composition)` to produce the six-by-nine contact sheet. `cardArtPreviewFixtures({ allVariants: true })` exports270 fixtures for all five approved base variants × six maneuvers × nine themes. These are compositions of existing assets, not54 or270 separately generated bitmaps.

The host can render fixtures with its usual asset URL resolver; this module deliberately does not fetch assets, read settings, access the DOM, or register a tool page. Example art well: a relative container with `overflow:hidden`, a full-size base image (`object-fit:cover; object-position:50% 50%`) with the returned filter, followed by the overlay markup.

Verification: `node --test tests/card-art-composition.test.mjs` checks all theme/action/variant combinations, real shipped card identities, resolved equipment tags, explicit empty/custom registries, all current status rows, aliases, deterministic caps, and escaping. Browser QA remains necessary to assess overlays inside actual card crops and thumbnails.
