# Map and battlefield art handoff

This is a documentation-only boundary between map integration branches and `feature/ImproveMapBattleFieldArt`, which supplies painted assets. Integration can proceed against stable component IDs and explicit placeholders while paintings are pending. Existing travel, encounters, discovery and save rules remain governed by their existing specifications; this file adds only a presentation contract.

## Editable sources and ownership

- Use [the SVG sheets](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/docs/design/improve-map-battlefield-art/01-hex-map.svg), [layer registration sheet](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/docs/design/improve-map-battlefield-art/02-layer-composition.svg) and [prop sheet](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/docs/design/improve-map-battlefield-art/04-map-prop-ideas.svg) to edit layout and inspect composition. Their rendered PNG siblings are design illustrations, not production textures. Regenerating sheets from `render-wireframes.mjs` or `render-discovery.mjs` overwrites their SVG/PNG outputs; persist lasting diagram changes in those generators.
- Use [hex-art.example.json](hex-art.example.json) for editable tile/profile associations and [EDITING.md](EDITING.md) for inheritance and selection rules. Keep [art-component-contract.example.json](art-component-contract.example.json) beside it as a separate component handoff example; it is not accepted by `hex-art.schema.json` and requires an adapter before runtime use.
- [props-examples/manifest.json](props-examples/manifest.json) catalogs editable prop examples and their local previews. These are layout/silhouette prototypes. A prototype path or ID does not imply a registered painted asset.
- Art owns the editable source, transparent PNG exports, dimensions, anchor/footprint metadata, compatibility tags and production asset bindings. Integration owns placement, resolver adapters, preview placeholders and saved visual choices. Coordinate changes to the contract version; swapping a painting under the same compatible component ID should need no map rewrite.

## IDs and pending assets

`componentId` is a stable presentation slot identity; `productionAssetId` is the eventual registered asset resolver ID. The example deliberately uses `status: "pending-painted-asset"`, `productionAssetId: null` and `exports: []`. These entries are requests, not promises that files exist. Do not invent production paths. Preview tools may render a labeled neutral silhouette from `placeholder`; release coverage must reject unresolved required components.

Keep component IDs stable across renamed files, resolutions and branch merges. Save logical IDs rather than a local filename, SVG node ID or device-specific PNG path. Once production is supplied, art replaces the null binding with a real catalog ID and records exports/metadata after checking them. Production art follows the repository's `AshenSpire-art` intake and release process.

## Map contract

Terrain tiles use a **512 px-wide PNG** for a roughly 256 CSS-pixel close view at 2× sampling; provide a **256 px-wide variant** for lower detail. A pointy-top hex is approximately **512 × 592**, or **256 × 296**, before any declared padding. This is per-tile resolution. A map prop can use a square transparent 512 × 512 canvas and 256 × 256 delivery variant; its size is independent of the hex footprint. Larger landmarks may need larger masters. Record actual dimensions instead of assuming square tiles or upscaling a thumbnail.

Use top-left origins and normalized anchors. A prop's anchor is its bottom ground contact, not the image center. The local prototypes use `(0.5, 0.85)` with transparent padding below; production metadata must report the actual ground contact if padding changes that point. Scale source canvas, anchor, footprint and hit area together. Anchor placement controls overlap sorting; transparent image bounds do not. Preserve alpha and avoid automatic trimming that moves the anchor.

| Component ID | Placement requirement | Artwork pending |
| --- | --- | --- |
| `map.bridge.stone.day.v1` | Stone bridge over a river, valid banks, explicit E/W crossing variant; bridge above water, approach joins registered | Painted transparent bridge, orientation variants and matching scene prop family |
| `map.camp.sheltered.day.v1` | Reachable usable clearing, forest/camp tags; show only when saved rest availability and discovery permit | Painted tent/fire/lantern group, matching rest props |

The example E/W orientation is a placement contract, not authority to create route edges. Bridges require explicit bank/connector checks; use painted orientation variants rather than rotating sunlight. Camps reuse saved rest state rather than rolling an independent icon. Map order is terrain → water/routes → anchored props → fog/discovery → selection/UI. Map landmark tags link to matching scene families without reusing map perspective in combat.

The example's `prototypeId` values `bridge` and `rest-camp` resolve only inside the local prop manifest. Its `pngAssetId: null` marks unregistered art; the handoff's longer component IDs describe proposed production slots. Keep these identities separate when building the adapter.

`showGridLines` and `showTileLabels` both default to **false**. They are independent controls; selecting, zooming or opening a preview must not enable either.

## Combat and rest contract

Both contexts use the same three-part **ground / props / sky** composition contract. Front-to-back artwork order is ground → rear props → sky; draw back-to-front as **sky → rear props → transparent-above-floor ground → actors/shadows → UI**. The ground cannot be an opaque full-frame painting. Rear prop bases meet its floor silhouette; floor props that overlap actors need a separately specified foreground/depth slot.

All three PNGs share one untrimmed canvas, origin, horizon, floor registration, lighting family and crop envelope. The example reserves a **2048 × 1152** landscape canvas around a centered **1280 × 720** view: 384 px horizontal and 216 px vertical bleed per side. Its horizon/floor numbers are proposed registration guides pending a painted proof. Do not treat those proposed guides as measured existing runtime anchors. Preserve current actor foot anchors when the integration branch maps the scene registration to its formation system.

| Role | Component ID | Requirement |
| --- | --- | --- |
| Ground | `scene.forest-clearing.ground.day.v1` | Clear standing area; transparent above the floor silhouette |
| Rear props | `scene.forest-camp.props.day.v1` | Tent/lantern landmark family shared with the map camp; alpha elsewhere |
| Sky | `scene.forest.sky.day.v1` | Compatible day/clear forest backdrop; a 2D plane |

All three paintings are pending. The example uses the same registered trio for combat and rest to prove interchangeability; later contexts can select different compatible prop pools. Keep rest-only tags on the props selector. A sky/time swap requires coherent ground/prop lighting. Clamp camera offsets inside registered bleed, budget shake/parallax within that margin, and never independently slide grounded props away from the floor.

## Selection and persistence

Resolve tile defaults/overrides first, then context and role pools. Require exact camera family, interior/exterior, registration and lighting compatibility; apply biome/setting and role-specific tags/conditions. A bridge requires valid crossing facts; a rest prop requires existing saved availability. Visual tags cannot grant gameplay. Do not require a sky to match a tent tag or silently weaken hard requirements to fill an empty pool.

Use a separate versioned art randomness domain keyed by the existing run seed, stable location ID, context and explicit occurrence counter. Order candidate IDs consistently before weighted selection. Save the art seed plus resolved component/production IDs and resolved weather/time with the scene; the saved choices remain authoritative on reload and across device/resolution changes. Rerolling an art preview changes only visual selection. Unavailable saved art needs an explicit compatible fallback/migration, never a gameplay reroll.

Keep this metadata outside the existing atlas revision/hash so presentation updates cannot invalidate a journey or change route seeds. The broader [proposal](README.md) and [editing guide](EDITING.md) remain the source for gameplay/save concerns; this handoff does not replace them.

## Review before binding production

Check actual exported dimensions/alpha, anchor placement over two map tiles, bridge bank alignment, shared scene registration and camera extremes. Compare 512/256 variants at their intended display sizes. Confirm stable selection after reload and independent Grid/Labels defaults. Missing required painted bindings must stay visible as pending coverage. This package itself changes no runtime code and claims no production art coverage.
