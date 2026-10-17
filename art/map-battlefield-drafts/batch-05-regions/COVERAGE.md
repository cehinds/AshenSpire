# Batch 05 location coverage

Editable art-only candidates for all 21 live location profiles across five regions and 200 node assignments. Every production binding is null. Asset paths resolve relative to this directory. No live content is changed.

| Region | Setting | Nodes | Candidate limitation |
| --- | --- | ---: | --- |
| ashen-crown | city | 9 | Regional outdoor candidate; visual review required. |
| ashen-crown | dungeon | 8 | Shared dungeon candidate: adapt materials, moisture, vegetation, snow or soot to ashen-crown; not bespoke regional interior art. |
| ashen-crown | forest | 0 | Regional outdoor palette candidate; add forest-specific vegetation density and edge framing. |
| ashen-crown | road | 24 | Regional outdoor candidate; visual review required. |
| hollow-weald | city | 4 | Ground is a regional material candidate; refine into a settlement courtyard or street surface. |
| hollow-weald | dungeon | 1 | Shared dungeon candidate: adapt materials, moisture, vegetation, snow or soot to hollow-weald; not bespoke regional interior art. |
| hollow-weald | forest | 11 | Regional outdoor palette candidate; add forest-specific vegetation density and edge framing. |
| hollow-weald | road | 24 | Regional outdoor candidate; visual review required. |
| pale-marches | city | 10 | Ground is a regional material candidate; refine into a settlement courtyard or street surface. |
| pale-marches | dungeon | 1 | Shared dungeon candidate: adapt materials, moisture, vegetation, snow or soot to pale-marches; not bespoke regional interior art. |
| pale-marches | road | 25 | Regional outdoor candidate; visual review required. |
| pale-marches | shore | 4 | Regional outdoor candidate; visual review required. |
| cinder-reach | city | 10 | Regional outdoor candidate; visual review required. |
| cinder-reach | dungeon | 1 | Shared dungeon candidate: adapt materials, moisture, vegetation, snow or soot to cinder-reach; not bespoke regional interior art. |
| cinder-reach | mine | 4 | Shared mine candidate: adapt materials, moisture, vegetation, snow or soot to cinder-reach; not bespoke regional interior art. |
| cinder-reach | road | 23 | Regional outdoor candidate; visual review required. |
| cinder-reach | shore | 2 | Review volcanic coastal backdrop against the map shoreline, including sea/tidal horizon and wet basalt.; Basalt road ground and spires are material candidates; refine into wet coastal basalt ground and shoreline props. |
| drowned-coast | city | 16 | Ground is a regional material candidate; refine into a settlement courtyard or street surface. |
| drowned-coast | dungeon | 1 | Shared dungeon candidate: adapt materials, moisture, vegetation, snow or soot to drowned-coast; not bespoke regional interior art. |
| drowned-coast | road | 18 | Regional outdoor candidate; visual review required. |
| drowned-coast | shore | 4 | Regional outdoor candidate; visual review required. |

## Interpretation and remaining work

- Coverage records candidate selection, not finished integration or guaranteed visual matching. The source of truth is `content/source/locationPresentation.json`, cross-checked against the five region IDs in `content/source/worldAtlas.json`.
- Ashen Crown forest is retained with zero nodes. All 200 live node assignments are preserved verbatim in the JSON, including four junction nodes. Region assignment follows the actual profile ID, not node-name inference.
- Dungeon grounds, gate and vaulted backdrop are intentionally shared across five regions. Mine art is a shared interior candidate used by Cinder Reach. They require regional material adaptation before approval.
- Cinder Reach shore uses its own `cinder-reach/backdrop-volcanic-shore.png` candidate. Review its sea/tidal horizon and wet basalt against the map shoreline. Its ground and spires also need shoreline refinement.
- Hollow Weald, Pale Marches and Drowned Coast city grounds reuse regional material candidates and need settlement street/courtyard refinement. Forest candidates need vegetation framing. Props are reusable accents, not a full bespoke set for every named map landmark.
- Proposed aliases are authoring vocabulary only: town/village/city → settlement (live city); castle/ruins/dungeon/legacy dungeon/snowcastle/monastery/abbey/foundry → ruined interior (live dungeon), with regional context. Existing live setting/profile IDs remain unchanged. Alias names never automatically override actual node bindings.
- Live scenes include day/night and weather selectors. These candidate files do not promise separate time/weather variants; lighting and weather adaptation remain to be reviewed.
- JSON structure, exact source profile IDs and node assignments, all source paths, and every referenced candidate PNG were validated locally. All 32 planned PNGs exist across the six asset folders.
