# Close-up location art

**86 new source PNGs · 27 location sets · 28 editable scenes · 12 Crownfall map candidates.**

The camera stands inside the location. Nearby facades, rock walls and trees frame an open center. Each scene references separate paintings: backdrop → side props → ground → optional floor props → filters → particles. Ground covers prop bases; it is not an image of a complete environment.

## Look at the art

[Independent components and rug-on/off example](preview-components.png) · [Separate rug PNG and provenance](../batch-11-floor-props/README.md)

- [Crownfall intro-map locations](preview-intro-map.png)
- [City, desert, jungle, snow, night and village streets](preview-streets.png)
- [Caves, forest, mountain road, great tree and open road](preview-nature.png)
- [Dungeon stairs, boss chamber, throne room, cinder tower and astrologer](preview-interiors.png)
- [Castle, enormous gate and volcanic castle](preview-castles.png)
- [Portrait, landscape and ultrawide examples](preview-cameras.png)
- [All 28 scenes](preview-all-scenes.png)

Source sheets show the actual individual layers on contrasting backgrounds: [streets](preview-sources-streets.png), [nature](preview-sources-nature.png), [interiors](preview-sources-interiors.png), [landmarks](preview-sources-landmarks.png), [intro](preview-sources-intro.png).

## Indoor and outdoor skyboxes

`modules/index.json.componentSlots` names the artist-facing slots. The existing JSON role `backdrop` is the skybox slot: outdoors it holds sky and distant scenery; indoors it is the back wall or fixed room shell. Each scene declares `backdropType: "room-shell"` or `"sky-and-distance"`. Pillars, bookshelves, stairs, thrones and furniture are separate transparent props. Existing backdrop paintings still contain some fixed architectural detail; these drafts do not isolate every distant wall fixture or architectural feature.

## Time of day is its own component

[Editable time-of-day module](modules/time-of-day.json) references existing transparent day and night PNGs (4096×4096), separately from weather filters. Each outdoor scene now contains one `filter` layer tagged `purpose: "time-of-day"`; rain adds a second filter tagged `purpose: "weather"`. Opacity is editable. Interior rooms keep local ambient lighting by default, but can opt into one time tint without admitting outdoor precipitation. Filters cover twice the longest viewport edge, within the documented native-resolution limit. HUD belongs above the tint stack.

[Filter on/off comparison](preview-time-filters.png). Day/night tint supports the lighting; a tint alone does not recreate painted night windows or lamps.

## Edit or import the JSON

- [Module index and cameras](modules/index.json)
- [One scene per file](modules/locations/)
- [Crownfall node-to-scene candidates](modules/intro-map.json)
- [Single portable JSON export](composition.example.json)
- [Measured PNG dimensions, alpha bounds, tags and hashes](manifest.json)

All asset paths in scene files resolve relative to `modules/index.json`'s `assetBase` (`..`). The portable export sits beside the PNG folders and uses `assetBase: "."`. References beginning `../batch-...` intentionally reuse earlier approved art. Do not copy or count those PNGs as new art.

Example scene layers:

```json
{
  "id": "city-street",
  "condition": "day",
  "interior": false,
  "productionBinding": null,
  "layers": [
    { "role": "backdrop", "asset": "city-street/backdrop.png" },
    {
      "role": "prop",
      "asset": "city-street/prop-left.png",
      "placement": {
        "mode": "side-framing",
        "side": "left",
        "innerEdgeU": 0.28,
        "heightFraction": 1.02,
        "baseOcclusionPixels": 14,
        "intentionalViewportCrop": true
      }
    },
    { "role": "ground", "asset": "city-street/ground.png" }
  ]
}
```

This shortened example omits the right prop. The editable scene file has both sides. `innerEdgeU` pins the inner edge of a prop's measured alpha silhouette to a fraction of the selected camera width. Left props stay left of 40%; right props stay right of 60%. A throne, forge workstation and smaller road markers use `rear-focal` placement, remain completely inside the camera, and sit above the ground horizon.

Intro mapping example:

```json
{
  "nodeId": "crownfall/forge",
  "displayName": "Blacksmith",
  "nodeTypeId": "service",
  "sceneId": "intro-forge",
  "position": { "x": 0.32, "y": 0.59 },
  "productionBinding": null,
  "additionalProps": []
}
```

The map module covers Crownfall, Blacksmith, Old Market, Wayfarer's Inn, Chapel of Embers, Royal Archive, Road Warden, and all five regional gates. Names, IDs and map positions are checked against `content/source/worldAtlas.json`, including its SHA-256 fingerprint. Destination-region tags belong to the gates; their scene remains physically in Crownfall. The five gates share a gate scene. The inn currently uses the painted night street; its dedicated frontage can follow later.

## Location coverage

| Group | Settings |
| --- | --- |
| Streets | City, desert bazaar, jungle settlement, snowy town, painted night city, village |
| Natural routes | Cave approach, forest path, mountain road, great tree, open road |
| Enclosed routes | Dungeon corridor, cave interior, stone tunnel, dungeon stairs |
| Monumental places | Castle grounds, massive gate/walls, indoor and outdoor boss arenas, throne room |
| Volcanic places | Castle exterior, castle interior, cinder tower |
| Specialist rooms | Astrologer chamber, Crownfall archive |
| Intro service props | Forge workstation, Chapel of Embers frontage |

The rain example adds existing translucent filter/particle layers to the city scene and records a modest preview grade. Night has separately painted ground, backdrop and facades. Interior scenes exclude outdoor rain/snow/sky overlays; a time-of-day tint is independently optional. Desert, jungle and snowy streets currently use daylight; earlier batch09 supplies additional biome weather/night components.

## Placement and resolution

The renderer reads `visibleBoundsAt32` and `medianCenterHorizonY` from the source manifest. It scales side props to camera height and aligns their inner silhouette edges, then draws ground over the bases. This deliberately allows outer roofs, walls and trunks to extend past the viewport. Source PNGs remain whole and unchanged. The open center is a geometry check for props; backdrop detail still requires human review.

The canonical preview canvas is 1672×941. 43 wide images are 1672×941, one wide image is 1672×940, and 42 square props are 1254×1254. The 3072×1728 /1536-square prompt requests are not the delivered resolution. A 940-high image registers to the preview canvas with a one-pixel CSS height adjustment; its file is not resized.

Four static crops are checked, including portrait and ultrawide. These provide adjustable framing within the painted area. Large unconstrained pans, zoom-outs or other aspect ratios need additional painted overscan. Source alpha margins vary; low-alpha fringe/dust and fine texture remain draft limitations. Straight floor/backdrop seams and differences in floor lighting need further registration and lighting polish, especially in enclosed scenes.

## Rebuild and validate

Run from the repository root:

```sh
python art/map-battlefield-drafts/batch-10-location-streets/build-manifest.py
node art/map-battlefield-drafts/style-system/build-library.mjs
node art/map-battlefield-drafts/style-system/apply-metadata.mjs
node art/map-battlefield-drafts/batch-10-location-streets/scenes.mjs --check
node art/map-battlefield-drafts/batch-10-location-streets/scenes.mjs --export
node art/map-battlefield-drafts/batch-10-location-streets/render-assets.mjs
node art/map-battlefield-drafts/batch-10-location-streets/render-previews.mjs
node --test art/map-battlefield-drafts/batch-10-location-streets/scenes.test.mjs
```

`build-manifest.py` requires original generation outputs at each provenance `sourceOutputPath`; it verifies byte identity and reviewed hashes. Those temporary original paths are provenance, not portable build inputs. Existing manifest validation and preview rendering work from checked-in assets. `create-modules.py` initializes templates from the brief plus the checked-in component definitions and rug placement and **overwrites hand-edited module JSON**; it is not part of routine validation.

All art remains proposal assets with `productionBinding: null`. Runtime map, combat and intro presentation wiring belongs to integration branches.

The default throne-room recipe uses the bare dungeon floor with a separately placed batch11 rug. The original batch10 floor/runner painting remains a legacy source, not the default floor. Flat floor props draw above ground; chairs, pillars and other rear props continue below ground at their bases.
