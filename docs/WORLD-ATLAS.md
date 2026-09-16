# World Journey content

Choose **World Journey** in character creation's Journey selector. Wanderer selects
20 world places; Long Expedition selects 26. Both use the same 200 authored places.
Crownfall is the starting city. One of five major cities and one of five legacy
dungeons are selected as the other anchors. Authored junctions allow cross-region
routes. Each alternative reconnects, and no road can bypass the required city.
Classic Climb and existing classic co-op runs keep their original progression.

The [content preview](../world-atlas-preview.html) renders the actual map and local
location components. It can show player discovery, a fully revealed selected
route, or all 200 candidate nodes. Its ID selector and diagnostics are authoring
tools; preview actions cannot change a real save. `?shot=atlas` on the game starts
a real World Journey with the existing isolated screenshot storage.

## Authoritative tables and derived views

`content/source/worldAtlas.json` is the editable relational source. Each top-level
property is one table, containing flat rows with stable IDs. The ordinary content
compiler validates it and produces `src/content/generated/worldAtlas.js`.
Never edit the generated module. `tools/world-atlas-schema.sql` defines the same
35-table database contract, including keys, foreign keys, uniqueness and checks.

The source is 3NF under these functional dependencies:

| Fact | Key and ownership |
| --- | --- |
| Map title and art | `maps.mapId` |
| World location's region and difficulty | `world_nodes.nodeId` |
| Node title, description and type | `nodes.nodeId` |
| Placement on a world map | `(world_map_nodes.mapId, nodeId)` |
| Local map owner | `local_maps.mapId`, with unique `ownerNodeId` |
| Fixed local placement | `local_map_nodes.nodeId` |
| Directed road and gate condition | `edges.edgeId`, unique map/from/to |
| Pool membership weight | `(enemy_pool_members.poolId, enemyId)` |
| Explicit encounter override | `node_encounters.nodeId` |
| Handler for a service type | `service_types.serviceTypeId` |
| Offered service or quest | Junction keys `(nodeId, serviceId/questId)` |
| Possible city-gate destinations | `(local_gates.nodeId, destinationNodeId)` |
| Profile and generation budgets | `run_profiles.profileId` |
| Ordered anchor rule | `(profile_anchors.profileId, roleId)` |
| Pins, exclusions, quotas and weights | Their declared profile/role/content keys |

No node copies its region's name or its map's art URI. A local point's region is
derived through its owning world node. `resolved_node_regions`, `map_nodes`, and
`resolved_service_handlers` are SQL views, not extra editable tables. Enemy and
encounter tables contain only reference IDs: names, statistics and enemy behavior
remain in the existing canonical registries. This is a normalized atlas content
contract, not a claim that every pre-existing AshenSpire subsystem is normalized.

## Database, CSV and JSON workflow

Node 22.14 or newer is required for the built-in SQLite API.

```powershell
# Export one CSV per table and equivalent content.json for review/editing.
node tools/world-atlas-data.mjs export --dir work/atlas-export

# Create an editable backend database; existing files are never overwritten.
node tools/world-atlas-data.mjs database --out work/world-atlas.sqlite

# Validate an import without changing source.
node tools/world-atlas-data.mjs import --from work/atlas-export
node tools/world-atlas-data.mjs import --from work/atlas-export/content.json
node tools/world-atlas-data.mjs import --from work/world-atlas.sqlite

# Import the chosen representation atomically, then build the game.
node tools/world-atlas-data.mjs import --from work/world-atlas.sqlite --write
node tools/content-build.mjs
node tools/launch.mjs --build-only
```

CSV, JSON and SQLite are alternative editing representations of one source.
They are not independently synchronized authorities. The import validates the
entire candidate before replacing source; failed imports leave source unchanged.
CSV empty cells represent null for nullable fields. Quotes, commas and multiline
text are supported. Foreign keys must be enabled in an external SQLite editor;
the import also checks them regardless of the editor's setting. A different SQL
backend can export these same flat table rows without changing game interfaces.
No remote database or production service is configured by this change.

## Content changes by ID

- **Change an enemy:** edit `enemy_pool_members.enemyId` for region patrols, or
  `node_enemy_pool_overrides` for one location. `node_encounters` takes precedence;
  every final dungeon must reference a registered boss encounter.
- **Add a location:** add a `nodes` row, a `world_nodes` row, a placement in
  `world_map_nodes`, and incoming/outgoing `edges`. Adjust `authoringTargetNodes`.
  Add a local map and its fixed points when the location needs an interior.
- **Pin a route:** add `profile_anchor_pins` for `start`, `hub`, or `final`.
  Type filters, required services, exclusions, weights and region quotas apply.
  Impossible rules fail with a profile/anchor/budget diagnostic; none are relaxed.
- **Change run variety:** tune `activeTarget`, main-route length, alternative
  limits, region quotas, `requireAllRegions`, and `allowBacktracking`. The default
  deliberately permits runs that omit regions. `revealRadius` is in map units.
- **Add a service:** bind a fixed local point through `node_services`. Registered
  handlers are shop, smith, rest and lore. New mechanics require a new validated
  handler; storing an arbitrary executable expression in content is unsupported.
- **Add a quest:** bind a local giver to a quest with an objective world-node ID
  and a cinder reward. A quest is available only when its objective is active.
  Acceptance and reward claims persist; a reward can only be collected once.
- **Gate a road:** reference a `conditions` row requiring a completed world node
  or explored local point. Generation checks that the requirement can be reached
  before the gated road. A local city gate lists possible authored destinations;
  the UI resolves the one currently reachable in this journey.

The initial interiors reuse the approved city painting and regional map paintings.
They are replaceable asset bindings; region interiors are not newly painted floor
plans. Crownfall has a separate transparent landmark illustration; other major
places lift a feathered crop of their own world location. Combat retains all 20
approved scenery choices, with the current journey region selecting its biome.

## Save and compatibility contract

Generation uses an isolated seed stream. It stores selected node/edge IDs, the main
route, anchors and resolved enemy outcomes. Resuming never rerolls the route.
Discovery, local exploration, service stock, rest claims and quests are run data.
Completed fights cannot be repeated for rewards. Shops keep their stock; resting
at a fixed local site is a single-use service in each run. Smithing uses the game's
existing item/currency transaction and can be repeated while affordable.

Each journey pins its content revision and profile version. A different content
revision refuses the save with an explanation and preserves the existing save
archive behavior; it does not silently migrate geography. Keep the matching
standalone build to finish an older journey. Classic saves are unaffected.

## Verification

`node tests/world-atlas.test.mjs` checks 300 seeds across both profiles, all anchor
options, disconnected travel refusal, explicit bosses, save roundtrips, stale
revision refusal, quest claims, invalid authoring data, CSV/JSON/SQLite parity,
and an update-anomaly check against the derived local-region view. Browser QA
also checks the actual game, location actions, desktop/phone layouts, and the
standalone bundle. This verifies mechanics and presentation, not combat balance.
