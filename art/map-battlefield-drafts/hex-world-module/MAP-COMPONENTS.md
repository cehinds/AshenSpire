# Map components and object mappings

**25 component types, 25 active matching icons and 39 historical variants, four authored map objects and two optional-discovery rules.**

![All mapped component types](map-components-preview.png)

## Edit the right JSON

| File | Purpose |
| --- | --- |
| [map-components.json](map-components.json) | Component module registry, sparse-placement defaults and art policy |
| [components/](components/) | Nine smaller category catalogs: tags, art pool, visibility, orientation and gameplay defaults |
| [art/map-props.json](art/map-props.json) | All 64 retained icon variants, exact source-manifest IDs and 25 art pools |
| [map-objects.json](map-objects.json) | Authored object instances and optional placement rules |
| [gameplay/discoveries.json](gameplay/discoveries.json) | Spawn chance, weights and component-to-gameplay mappings |
| [map-component-mapping.json](map-component-mapping.json) | Generated portable mapping of every component and icon variant |

Every map painting from batches 01–03 and 07 and every earlier technical icon is mapped. Only batch 07 is eligible under the active style policy. Battlefield grounds, skies, scene props and filters retain their independent catalogs; the 25-type catalog describes map landmarks and services.

## Component families

| Category | Types |
| --- | --- |
| Crossing | Bridge, ford |
| Route | Road/junction, signpost |
| Transport | Tunnel, ferry, portal, boat |
| Adventure | Cave, dungeon, mine |
| Settlement | City, town, village |
| Landmark | Ruins, shrine, watchtower |
| Accessory | Treasure chest |
| Encounter | Enemy camp |
| Service | Rest camp, inn, trainer, merchant, cartographer, fishing |

Each type has tags, an art-pool ID, placement selectors, required connector kinds, visibility rules, orientation settings and gameplay references. Earlier technical anchors/footprints are retained as **illustrative metadata**; they do not calibrate painted variants, define tile occupancy, or create collision/click targets.

## Example: place a bridge object

The [crossing catalog](components/crossing.json) defines `bridge` once. An instance in [map-objects.json](map-objects.json) references it:

```json
{
  "id": "bridge-object",
  "tileId": "bridge",
  "componentId": "bridge",
  "placement": {
    "u": 0.5,
    "v": 0.55,
    "scale": 0.55,
    "rotationDegrees": 0
  },
  "linkedInstanceId": null,
  "gameplayOverrides": {}
}
```

`u`/`v` are normalized coordinates in the owning tile, from its top-left. Scale is relative to the tile's render box. The validator requires road and river connectors for a bridge and keeps upright icons at zero sprite rotation. Choosing direction-specific art for connector alignment still needs editor/render work.

The owning tile stores `mapArt.objectIds: ["bridge-object"]`. Its earlier `propsPoolId: "map-bridge"` is a checked compatibility mirror of the first authored object. Add instances to `map-objects.json`, add the matching tile backlink, and update that mirror if the primary object changes.

## Example: hidden treasure or trainer

An optional rule references the existing discovery pool:

```json
{
  "id": "forest-road-landmarks",
  "discoveryPoolId": "sparse-road-discoveries",
  "eligibleTileIds": ["forest-road"]
}
```

That pool has a 20% spawn chance, then chooses one weighted eligible entry. The existing nearby camp excludes another rest-camp candidate within its spacing rule. An entry carries both a map component and a gameplay reference:

```json
{
  "kind": "loot",
  "refId": "travel-supplies",
  "weight": 3,
  "componentId": "treasure"
}
```

This maps the chest picture to a loot table while preserving the same roll and entry-triggered reveal. It does not add a second spawn roll. The riverbank rule similarly maps fishing markers to `river-cache` with a 15% discovery chance.

- Sparse placement keeps empty tiles valid, excludes tiles with authored landmarks, and saves seeded outcomes per run.
- Routes do not occupy the landmark slot; a road tile can still host a small discovery.
- The proposed global occupancy cap rounds upward for small eligible sets. The candidate helper checks spacing against authored objects. The future placement engine must also enforce spacing among generated outcomes and the global occupancy cap.
- Map-item fog reveals do not expose entry-triggered treasure, trainers or enemy camps. Their component visibility rules keep those markers hidden until the specified trigger.
- Portal, tunnel and ferry instances require reciprocal endpoints. Definitions alone do not establish travel links.

## Art and gameplay resolution

**Art:** filter by `artPolicy.requiredStyleSetId` → apply tile-tag predicates → choose a painted variant. All 25 types now use `map-icons-painterly-v1`; technical placeholder fallback is disabled. The original 39 variants retain their exact IDs and source links for history, but cannot enter this set. `activeVariantIds` in the portable export identifies the current style collection before context-dependent tag filtering. A missing matching style produces no candidate and fails validation; it never silently substitutes an older painting.

The [editable style guide](../batch-07-map-icons/style-guide.json) defines the camera, palette, lighting, framing and readability checks. New variants must carry the same `styleSetId` in both their source manifest and art mapping, and pass visual review alongside the existing set. Tags still decide where an icon can appear; style IDs decide which collection it belongs to.

**Gameplay:** start with the tile's values; non-null component scalar defaults replace their associations; component quest/effect arrays add unique IDs; explicit instance overrides replace fields, with null disabling a scalar association. Clearing an encounter pool also clears its inherited encounter chance. Level bands inherit from the tile unless overridden. Optional discovery entries supply their selected loot/rest/trainer binding as an override.

These helpers resolve data associations. They do not spawn encounters, grant rewards, place objects or execute interactions. An icon never creates a gameplay action by itself. Production bindings remain null.

## Validate, export and preview

From the repository root:

```sh
node art/map-battlefield-drafts/hex-world-module/validate.mjs
node --test art/map-battlefield-drafts/hex-world-module/validate.test.mjs art/map-battlefield-drafts/hex-world-module/map-components.test.mjs
node art/map-battlefield-drafts/hex-world-module/map-components.mjs --export
node art/map-battlefield-drafts/hex-world-module/render-map-components.mjs
```

Edit the source catalogs and instances; regenerate the portable mapping afterward. Tests detect stale generated mappings. The preview sheet composes existing PNGs unchanged and requires Playwright/Chromium; set `CHROMIUM_PATH` when needed. The validator also checks complete source-manifest coverage, component/pool agreement, tile/object backlinks, connector requirements, upright orientation, gameplay references and paired endpoint links.
