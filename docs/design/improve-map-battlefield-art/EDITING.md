# Editing regions and tiles

Start with **[hex-art.example.json](hex-art.example.json)**. It is ordinary JSON: two-space indentation, one property per line, no comments, no trailing commas, and no technical essays embedded in the tile records. It imports into JSON-aware tools without preprocessing. The `$schema` entry points editors to [hex-art.schema.json](hex-art.schema.json) for field suggestions and shape validation.

Reusable definitions are in **[tile-content.catalog.json](tile-content.catalog.json)**. Keep the files together; `catalogFile` is a relative path. The example and schema describe a proposed authoring format, not an installed game feature. All geography, enemies, quests and balance values are illustrative. Empty art `assetIds` and null `runtimeId` / `existingNodeId` values deliberately identify content awaiting production assets or runtime mapping.

## The structure

| Where | What to edit |
| --- | --- |
| `map.display` | Independent grid-line and tile-label defaults |
| `regions[].defaults` | Shared terrain, art, difficulty, encounters, weather and discovery rules |
| `regions[].tiles[]` | A tile's stable ID, position, tags and property overrides |
| `roads[]` | Ordered neighboring tiles forming a road; branches share junction tiles |
| `biomeTransitions[]` | Shared-edge blends between grass, forest and jungle |
| Catalog `artProfiles` / `artPools` | Map, combat and rest layer selection |
| Catalog `encounterPools` / `encounters` / `enemies` | Enemies permitted in each section |
| Catalog `weatherProfiles` / `weather` / `effects` | Weather chances, visuals and future buffs/debuffs |
| Catalog `lootTables` / `items` / `quests` | Unique drops and quest hooks |
| Catalog `trainerPools` / `trainers` / `restPools` / `restSpots` | Discoverable trainers and rest locations |

## Edit one tile

The following tile already exists in the example. Its `position` is zero-based column 1, row 2, so its displayed address would be **B3** if labels were enabled. The ID remains stable if the tile moves.

```json
{
  "id": "ruined-watch",
  "name": "The Broken Watch",
  "position": {
    "column": 1,
    "row": 2
  },
  "existingNodeId": null,
  "tags": [
    "ruins",
    "stone",
    "danger"
  ],
  "properties": {
    "setting": "ruins",
    "artProfileId": "ruins",
    "encounters": {
      "poolId": "ruin-guardians",
      "chance": 1
    },
    "difficulty": {
      "tier": 3,
      "multiplier": 1.6,
      "warning": "Elite guardians beyond the broken arch"
    },
    "lootTableId": "watch-relic",
    "questIds": [
      "recover-watch-banner"
    ]
  }
}
```

Set `existingNodeId` only when binding a tile to an actual existing world location. Authoring tile IDs and existing gameplay IDs remain distinct; roads refer to authoring tile IDs. Duplicate neither ID nor position within a map. For multi-tile settlements, use distinct gameplay sublocation IDs or one explicitly designated entry tile; do not bind several tiles ambiguously to the same node.

## Defaults and overrides

Resolve **region defaults → tile properties**. This file has no hidden global gameplay defaults. Objects merge recursively; omitted keys inherit; scalar values replace; arrays replace entirely. `[]` clears an inherited list. `null` clears an optional reference or warning; it never means “inherit.” Required fields cannot be null. A resolved tile must have all fields shown in the sample region defaults, including both discovery rules.

For example, a jungle tile can override only `difficulty.multiplier`; its regional tier and warning still apply. To make a tile safe, set both `encounters.poolId` to null and `encounters.chance` to 0. A positive chance with a null pool is invalid. To remove a quest inherited from a region, set `questIds` to `[]`.

`tags` are tile-specific descriptive/visual tags. They do **not** grant buffs, spawn enemies, change difficulty or award loot. Use explicit property fields for those behaviors. Select compatible assets by biome, setting, surface, camera, layer, lighting and relevant tags. Do not require a ground PNG to carry every prop tag on the tile.

## Chances, pools and difficulty

Every `chance` is a probability from **0 to 1**: `0.2` is 20%, `1` is guaranteed, `0` is disabled. A pool's positive `weight` is relative to its peers and applies only after the availability roll succeeds. Trainer and rest rolls are independent, so both may be present. The example allows both; a future mutually exclusive event category would need its own explicit rule.

An encounter availability roll selects one encounter from the tile's resolved pool. A quest or boss encounter must be integrated through an explicit override/priority rule before adding one to this draft; it must not be silently replaced by an incidental roll. Regions define broad enemy territories; tile pool overrides establish local exceptions. The forest approach has forest hunters, while jungle roads use jungle stalkers. The ruined watch has guaranteed elite guardians and a visible warning.

`difficulty.tier` chooses a proposed content band; `multiplier` is a separately authored tuning factor, not a hidden effect of art tags. Exact affected stats and limits require a gameplay spec before implementation. The sample values are design examples, not changes to combat balance. Surface danger through landmarks and warnings even when tile labels are hidden.

Availability decisions are resolved once per tile per run. Use separate versioned randomness domains for encounter, weather, art, trainer, rest and loot, keyed by run seed + stable gameplay node (or authoring tile ID for new content) + decision ID + explicit occurrence counter. Save the result; loading, revisiting, redrawing, moving the camera or toggling the grid must not reroll it. Existing journey outcomes remain authoritative during migration.

## Grid and labels

Both start false:

```json
"display": {
  "showGridLines": false,
  "showTileLabels": false
}
```

Provide two small independent controls, **Grid** and **Labels**, with accessible names, keyboard focus, pressed state and touch-sized hit areas. Grid shows only hex boundaries. Labels shows the tile addresses. Neither control changes the other. Hover, selection, zoom and opening an editor must not turn labels on automatically. No address/coordinate axes or tile text overlays appear on the map while Labels is off; a selected location's inspector can still show its descriptive name. Editor property forms may show stored coordinates for editing. Remember the player's explicit choice separately from authored defaults.

Position uses a pointy-top odd-row offset grid. A1 is `(column: 0, row: 0)`; odd zero-based rows shift right by half a hex width. Derive letters A…Z, AA… from column + 1 and the displayed number from row + 1. Do not store a second editable address that can drift out of sync. Convert to axial geometry with `r = row; q = column - (row - (row & 1)) / 2`.

## Roads and changing biomes

The main road is **Westwatch → Three Ways → Fernwood Approach → Overgrown Road → Canopy Gate**. The example's branches lead from Three Ways to the Broken Watch and from Fernwood Approach to Lantern Clearing. All successive cells are hex neighbors.

Edit a road's `tileIds` in travel order. A `surfaceChanges` entry starts at the named tile and continues to the next change/end of that road. Grassland cobbles become worn forest stone, then vine-covered jungle stone. A terrain biome changes through a tile property; a road surface change alone does not turn the biome into jungle.

Derive reciprocal six-edge connections from the road path, then bend the art within each cell around shared junction and edge anchors. Draw shared trunks once. Shared edges must have compatible surfaces or an explicit blend. Neighbor direction order is E, NE, NW, W, SW, SE; opposite pairs are E/W, NE/SW, NW/SE. List every shared edge whose neighboring biomes differ; missing boundary coverage is an authoring error. Each biome transition owns one shared edge through `ownerTileId`, which must be one of its two adjacent tiles. This avoids painting a blend twice. Bridges must explicitly cross compatible water edges in an expanded production schema.

Road art does not grant travel permission. Keep current route rules during the art phase; adopting new roads as gameplay links is a later versioned content change.

## Combat and layered rest scenes

A tile's `artProfileId` selects three contexts: `map`, `combat`, and `rest`. Combat/rest contexts each reference ground, props and sky pools. The default composition is **sky → rear props → transparent-above-floor ground → actors → UI**. Contexts share registered oversized canvases, floor alignment, crop constraints and resolved weather/time. The tile property `timeOfDay` is `inherit-run`, `day`, `dusk` or `night`. `inherit-run` reads the existing `run.presentationTimeId`, defaulting to `day` when absent. Resolve and save that lighting context with the scene; invalid run time IDs require an explicit migration/fallback rather than an arbitrary sky.

When a rest spot is discovered, use the same tile art profile's `rest` context plus the spot's tags. Scope rest-specific tags to the appropriate props/setting filter. A city courtyard adds inn/courtyard props; a jungle clearing adds canopy, lantern and camp props over jungle ground. The example's inn is explicitly an outdoor courtyard so the outdoor sky remains compatible. A future interior inn needs an interior backdrop/profile.

Art pool `requiredTags` are minimum selectors. Empty `assetIds` intentionally mark unfilled pools; they are not valid production pools and must fail a production coverage check. Replace them with real asset catalog IDs before implementing a preview. Asset records must supply camera/lighting/biome/setting compatibility and registered PNG dimensions. Never silently relax a landmark, biome or interior requirement to fill an empty pool.

Rest availability is a gameplay decision; selecting or adjusting its visual layers cannot change that outcome. Show the art on discovery, but apply rest rewards only after the player completes the rest action.

## Weather, rewards and quests

Weather profiles use weighted weather IDs. Visual weather and gameplay consequences are separate: future effects require **both** `weather[...].gameplay.enabled` and `effects[...].enabled`. The draft sets all effects disabled. `environmentEffectIds` can explicitly attach a catalog effect to a tile later, and completed-rest effects are referenced by the rest spot; those still honor their effect's enabled flag. Effect definitions include trigger, target, duration, stacking, removal and proposed modifiers. Map the draft stat names to the existing engine before activation. Decide weather schedules and mid-combat transitions in the gameplay spec; this example samples weather once per tile per run.

The watch medallion has a 15% roll on victory, rolled once per tile per run, and at most one copy per run. Save a failed roll too. On success, persist the pending reward and reserve its unique item ID across pending offers. Commit claim plus uniqueness receipt atomically. Reloading or repeating a fight cannot retry the roll or duplicate the item. Profile-wide uniqueness requires durable profile storage and is not implied by `uniqueScope: "run"`.

Tile `questIds` reference quest definitions. Offer, accept, progress, complete and reward are separate states; merely entering the tile does not complete a quest. The herbalist offer should require that trainer to be present; it must not generate an impossible required objective when the trainer roll fails. Reuse the existing quest/reward systems rather than inventing another completion path.

## Optional map-prop and discovery draft

See [map-discovery.example.json](map-discovery.example.json) and [its illustrated guide](MAP-PROPS-AND-DISCOVERY.md) for sparse PNG props, reveal triggers, connected discovery sections and map-item rewards. This separate proposal references the world tile IDs; it is not validated by `hex-art.schema.json` and does not change the main world format.

## Tool validation and eventual integration

The JSON Schema validates the world file's structure and numeric ranges. It does not validate cross-file catalog references, inherited completeness, unique IDs, road adjacency, runtime IDs or asset coverage. Those are separate semantic checks. Keep unknown fields rejected so a typo such as `encouterChance` cannot silently disappear during import.

Production tooling can compile this convenient nested authoring format into normalized tables. Keep visual content revisions separate from gameplay revisions: changing a sky or label should not reset a journey; changing enemies, loot, quests or traversal must use the game's explicit migration/spec process. Never insert this draft wholesale into the existing atlas hash. The current checked-in files are documentation and examples only.
