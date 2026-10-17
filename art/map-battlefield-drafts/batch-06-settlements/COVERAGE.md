# Batch 06 editable location pools

Draft candidate compositions for 21 existing profiles, five regions and 200 live node assignments. Production bindings are null. These files do not integrate assets into runtime or mark art complete.

## Editing and selection

Edit `modules/regions/<region>/pools.json`; common rules/source metadata live in `modules/shared/location-pools.json`. The [module index](modules/index.json) connects them. `location-pools.example.json` is a generated flat export for other tools. Regenerate it with `node json-modules.mjs` from this batch directory after edits.

Each profile contains ordered `primaryPools` and `fallbackPools`. Select one complete composition within the exact profile. A primary prefers batch 06 where available; a fallback preserves the previous batch 05 proposal. Unchanged profiles intentionally have identical primary and fallback assets. Add alternatives to the appropriate array rather than mixing arbitrary regions. Props are optional accents requiring composition review. Paths resolve from this directory.

Structured selection tags record region, existing setting and material. Tags support manual discovery; they do not create live IDs or change source assignments. `assignmentSource` points directly to live `nodeProfiles` filtered by exact profile ID. The provenance digest records the exact source node/profile pairs without duplicating 200 node IDs.

| Profile | Nodes | Primary origin |
| --- | ---: | --- |
| ashen-crown/city | 9 | batch-06-settlement |
| ashen-crown/dungeon | 8 | batch-06-regional-interior |
| ashen-crown/forest | 0 | batch-05-retained |
| ashen-crown/road | 24 | batch-05-retained |
| hollow-weald/city | 4 | batch-06-settlement |
| hollow-weald/dungeon | 1 | batch-06-regional-interior |
| hollow-weald/forest | 11 | batch-05-retained |
| hollow-weald/road | 24 | batch-05-retained |
| pale-marches/city | 10 | batch-06-settlement |
| pale-marches/dungeon | 1 | batch-06-regional-interior |
| pale-marches/road | 25 | batch-05-retained |
| pale-marches/shore | 4 | batch-06-frozen-shore |
| cinder-reach/city | 10 | batch-06-settlement |
| cinder-reach/dungeon | 1 | batch-06-regional-interior |
| cinder-reach/mine | 4 | batch-05-retained |
| cinder-reach/road | 23 | batch-05-retained |
| cinder-reach/shore | 2 | batch-05-retained |
| drowned-coast/city | 16 | batch-06-settlement |
| drowned-coast/dungeon | 1 | batch-06-regional-interior |
| drowned-coast/road | 18 | batch-05-retained |
| drowned-coast/shore | 4 | batch-05-retained |

## Scope and remaining review

- Five city profiles receive regional settlement ground and building candidates, retaining their batch 05 regional backgrounds and accent props. They still need visual scale, contact and lighting review.
- Five dungeon profiles receive regional ground candidates. All five still share the batch 05 vaulted background and iron gate; regional ground does not imply a bespoke dungeon environment.
- Pale Marches shore receives ice-bank ground and a frozen-inlet backdrop. The backdrop lives under `interiors/` for file organization but is referenced only by the Pale Marches shore profile.
- Road, forest, mine and other shore profiles retain their prior candidates. Cinder shore keeps the separate volcanic coastal backdrop; its ground/shore prop refinement remains pending.
- Ashen Crown forest remains a live profile with zero node assignments. Junctions follow their actual source assignments. Counts alone do not infer node identity; the recorded digest verifies exact pairs.
- Night/weather variants, regional dungeon backgrounds and full prop variety remain review work. Candidate pools are editable art proposals with no runtime behavior.

## Validation

Validated all 21 exact live profile IDs, all 200 unique node assignments against worldAtlas, source selectors, provenance paths and the exact assignment digest. All 49 referenced PNGs exist: 17 new batch 06 sources and 32 retained batch 05 sources. Primary/fallback paths and region selection consistency were checked; all fallbacks reference batch 05.
