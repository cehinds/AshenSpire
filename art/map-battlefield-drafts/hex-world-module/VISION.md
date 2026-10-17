# The vision: an authored world with controlled variation

**Choose the important geography; randomize the small discoveries inside it.**

## 1. Give every tile four jobs

- **Geography:** its coordinates, biome and edge connections.
- **Presentation:** map art plus independent battlefield ground, skybox, props, filters and weather pools.
- **Gameplay:** encounter pools, difficulty, traversal cost, loot, quests, trainers, rest and environment effects.
- **Discovery:** when the player learns about the tile and when hidden content becomes visible.

The player save belongs beside this content, not inside it. A chest being collected or an enemy being defeated must not change the reusable tile template.

## 2. Let geography guide the art

- A road can enter a grassland tile and leave through a forest edge. The center biome chooses the main ground palette; explicit side profiles carry transitions, and touching sides must match their full signatures.
- A bridge carries road connections across a river. Validate road continuity and river direction independently of what the art looks like.
- A snowy settlement can reuse a town layout while choosing snowy paving, roofs, cold filters and snow particles.
- A rest scene can reuse the tile's ground/background family, with its own tent, fire or shelter props. It does not have to reuse the combat layout.

**Suggested next biomes:** jungle, marsh, snowfield, alpine, volcanic, coastal and underground. Keep *biome* separate from *location type*: a town can be snowy, coastal or forested. Keep *region* separate too: regions are named world areas, not material palettes.

## 3. Avoid clutter and repeated rerolls

- Place cities, main roads, bridges and critical quest entrances deliberately.
- Use low-density seeded pools for optional camps, trainers, ruins and treasure.
- Roll once per tile/discovery per run; save the result. Leaving and returning should not repeatedly reroll until a rare item appears.
- Add spacing and exclusion rules before procedural placement is wired: minimum distance between towns/rest spots, no camp inside a river, no overlapping main landmarks.
- Distinguish a revealed tile from a discovered prop. A map can reveal terrain without exposing its hidden chest.

The example discovery pool proposes a 20% chance to roll one weighted optional discovery when the tile is entered. This is example balancing, not a production recommendation.

## 4. Give map rewards distinct purposes

Useful reward types:

- **Survey fragment:** reveal a connected cluster of nearby hexes.
- **Route chart:** reveal the road between two known places.
- **Treasure sketch:** mark one target location without granting the loot or automatically revealing all intervening tiles.
- **Explorer's notes:** disclose enemy families, environmental hazards or trainer rumors before entering.

Keep these effects in reveal/reward modules. Fog visibility, landmark discovery and reward collection are different states. A route chart should not fire enter-tile encounters or discover every hidden prop along the route.

## 5. Make encounters fit the place

- Store each enemy type once; encounter pools reference it with weights and tag conditions.
- Separate encounter chance, group size, enemy weights and difficulty. A larger group is not the same knob as a harder enemy.
- Reserve deliberate danger spikes for named areas and give the player a visible clue or warning.
- Four proposed level bands now define separate recommended-player, enemy and reward ranges. Add faction, elite/boss eligibility, spawn budgets and cooldowns as the runtime needs them.
- Keep rest safety explicit. A "safe" tag should eventually enforce zero encounter risk; a risky camp should be tagged and signaled differently.

## 6. Keep effects composable

- Select one time-of-day filter, then compatible weather/effect layers.
- Clouds/skybox, color grading, fog, rain and lightning remain separate choices.
- Scroll seamless rain/snow/ash tiles. Move non-seamless fog only within its overscan bounds; do not wrap a visible seam across the screen.
- Place distant lightning behind foreground props and ground. Keep long, seeded gaps between flashes.
- Preserve generous source coverage beyond the viewport; a JSON overscan field cannot add missing painted pixels.

## Recommended next decisions

1. **Adopt the six-side convention now.** Changing coordinate/rotation rules after map authoring is expensive.
2. **Start with a curated small region.** Use these six examples to wire an editor and validate connections before filling hundreds of tiles.
3. **Add a preview/editor validation panel.** Show unmatched exits, unknown IDs, incompatible tags, empty eligible pools and missing art.
4. **Allow multiple connector channels later if needed.** Version 1 has one optional connector per side; a road alongside a river on the same edge would require a versioned extension.
5. **Define the save contract before discovery ships.** Stable tile/discovery IDs plus a content version and saved random outcomes prevent accidental rerolls after art updates.

These are suggestions for the next implementation stage. The current module provides draft data, schema and validation; the game behavior remains to be wired.
