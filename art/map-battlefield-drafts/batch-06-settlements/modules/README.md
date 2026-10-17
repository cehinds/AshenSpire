# Edit the art as JSON modules

**Start at [index.json](index.json).** These are ordinary JSON files, readable by other tools without JavaScript import syntax.

```text
modules/
├── index.json                 module list + asset path base
├── shared/
│   ├── location-pools.json    selection rules + source assignments
│   └── composition.json       canvas + cameras + placement rules
└── regions/
    ├── ashen-crown/
    ├── hollow-weald/
    ├── pale-marches/
    ├── cinder-reach/
    └── drowned-coast/
        ├── pools.json         preferred and fallback art by location
        └── scenes.json        preview placement and layer choices
```

Every region folder contains both `pools.json` and `scenes.json`. The loader also checks all candidates against the [shared reviewed style library](../../style-system/README.md); historical outliers and wrong layer roles are rejected.

## What to edit

| Change | File |
| --- | --- |
| Choose a location's ground, props or backdrop | Its region's `pools.json` |
| Move/resize props or change a preview composition | Its region's `scenes.json` |
| Change portrait/wide camera crops | `shared/composition.json` |
| Change common selection rules or source metadata | `shared/location-pools.json` |
| Register a region module or change presentation order | `index.json` |

- The index's module paths are relative to the index directory.
- **All asset, source-data and provenance paths inside modules are relative to `assetBase`**, which is the batch directory one level above this index. Moving a record between modules never changes its image paths.
- Keep `regionId` and profile/scene ID prefixes aligned with the region folder. Location profiles refer to existing live assignments; adding a scene does not create a new live location.
- New scene IDs append automatically. Add them to `sceneOrder` only when a specific preview order matters. Remove an ID from `sceneOrder` when deleting its scene.
- Shared metadata is loaded once. Region profiles/presets are concatenated in index order; duplicate IDs and missing file references are errors. No implicit deep merge or cross-region random selection occurs.
- Each chosen pool is a complete candidate. `primaryPools` and `fallbackPools` retain their earlier meaning; shared interior assets are allowed where explicitly referenced.

## Preview or export

From the repository root:

```sh
# Validate modules and referenced files without writing exports.
node art/map-battlefield-drafts/batch-06-settlements/json-modules.mjs --check

# Rebuild portable, single-file JSON exports after editing modules.
node art/map-battlefield-drafts/batch-06-settlements/json-modules.mjs

# Preview reads the modules directly, including edits not yet exported.
node art/map-battlefield-drafts/batch-06-settlements/render-previews.mjs

# Check loader behavior and confirm exports match the modules.
node --test art/map-battlefield-drafts/batch-06-settlements/json-modules.test.mjs
```

The generated exports are `../location-pools.example.json` and `../composition.example.json`. **Edit modules, then regenerate exports**; editing an export alone will not change previews and will be overwritten on the next export. `--check` validates module references; the test command additionally detects stale exports.

Other tools can load the index, resolve `assetBase`, read the shared metadata and concatenate each region's arrays. They can also consume the flat exports directly. The exported JSON keeps the earlier field structure and references; no game-runtime wiring is introduced.
