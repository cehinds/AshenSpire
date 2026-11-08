# Enemy level budget: pools before and after

Generated for owner backlog #9 (SPEC §17, Enemy levels and stat budget). No balance number was changed by hand; this only reports the effect of the new level and budget rule. Before = `origin/dev` at the branch base, after = this branch. Attributes are own points as STR/DEX/CON/WIS/INT (before gear and relics). Pools are HP/SP/MP including gear and relics.

| Enemy | Tier | Level (before > after) | Own attrs before | Own attrs after | HP before > after | SP before > after | MP before > after |
|---|---|---|---|---|---|---|---|
| Wandering Soldier | minion | 1 > 1 | 1/1/0/0/0 | 2/1/1/1/1 | 15 > 64 | 1 > 1 | 1 > 1 |
| Blight Hound | minion | 1 > 1 | 1/1/0/0/0 | 1/2/1/1/1 | 15 > 62 | 1 > 1 | 1 > 1 |
| Husk Brute | minion | 2 > 1 | 1/1/0/0/0 | 2/1/1/1/1 | 20 > 64 | 1 > 1 | 1 > 1 |
| Grave Wisp | minion | 1 > 1 | 0/0/0/1/1 | 1/1/1/2/1 | 14 > 34 | 2 > 2 | 1 > 2 |
| Wyrm Aspirant | elite | 4 > 2 | 1/1/0/2/0 | 2/1/1/2/1 | 36 > 55 | 3 > 3 | 2 > 2 |
| The Fell Warden | boss | 5 > 3 | 2/2/1/1/0 | 2/2/2/1/1 | 60 > 87 | 3 > 3 | 1 > 1 |
| Lantern Moth | minion | 2 > 1 | 0/0/0/1/1 | 1/1/1/2/1 | 19 > 34 | 2 > 2 | 1 > 2 |
| Briar Hermit | minion | 2 > 1 | 1/0/0/1/0 | 2/1/1/1/1 | 20 > 64 | 1 > 1 | 1 > 1 |
| Chain Scavenger | minion | 2 > 1 | 1/1/0/0/0 | 2/1/1/1/1 | 15 > 36 | 2 > 2 | 1 > 1 |
| The Bell Keeper | boss | 5 > 3 | 2/1/1/2/0 | 2/2/1/2/1 | 61 > 91 | 3 > 3 | 2 > 2 |
| The Thorn Matriarch | boss | 5 > 3 | 2/1/0/2/1 | 2/1/1/2/2 | 62 > 89 | 3 > 3 | 2 > 2 |
| Gilded Knight | minion | 6 > 2 | 1/1/0/0/0 | 2/2/1/1/1 | 35 > 44 | 2 > 2 | 2 > 1 |
| Court Surgeon | minion | 6 > 2 | 0/0/0/1/1 | 1/1/1/2/2 | 39 > 40 | 2 > 2 | 2 > 2 |
| Stitched Hound | minion | 6 > 2 | 1/1/0/0/0 | 2/2/1/1/1 | 40 > 72 | 1 > 1 | 2 > 1 |
| Court Marionette | minion | 6 > 2 | 1/1/0/0/0 | 2/2/1/1/1 | 40 > 72 | 1 > 1 | 2 > 1 |
| Living Armor | minion | 7 > 2 | 1/1/0/0/0 | 2/2/1/1/1 | 45 > 72 | 1 > 1 | 2 > 1 |
| Duelist of the Court | elite | 10 > 3 | 2/1/1/0/0 | 2/2/2/1/1 | 65 > 79 | 3 > 3 | 2 > 1 |
| The Stitched King | boss | 11 > 4 | 2/2/1/1/0 | 3/2/2/1/1 | 139 > 156 | 3 > 3 | 5 > 5 |
| Mirror Scribe | minion | 7 > 2 | 0/0/0/1/1 | 1/1/1/2/2 | 44 > 40 | 2 > 2 | 2 > 2 |
| Stitch Crab | minion | 7 > 2 | 1/1/0/0/0 | 2/2/1/1/1 | 45 > 72 | 1 > 1 | 2 > 1 |
| The Glass Regent | boss | 11 > 4 | 2/1/0/2/1 | 3/1/1/2/2 | 87 > 104 | 3 > 2 | 4 > 2 |
| The Marrow Organist | boss | 11 > 4 | 2/1/0/2/1 | 3/1/1/2/2 | 87 > 104 | 3 > 3 | 4 > 2 |
| Ash Revenant | minion | 13 > 3 | 1/1/0/0/0 | 2/2/2/1/1 | 75 > 87 | 1 > 1 | 3 > 2 |
| Ember-Starved Pilgrim | minion | 13 > 3 | 1/1/0/0/0 | 2/2/2/1/1 | 75 > 87 | 1 > 1 | 3 > 2 |
| Valkyrie Shade | minion | 14 > 3 | 1/1/0/0/0 | 2/2/2/1/1 | 80 > 87 | 1 > 1 | 3 > 2 |
| Charred Colossus | minion | 15 > 3 | 1/1/0/0/0 | 2/2/2/1/1 | 85 > 87 | 1 > 1 | 3 > 2 |
| Wyrm Lord | elite | 18 > 4 | 2/1/1/0/0 | 3/2/2/1/1 | 145 > 127 | 3 > 3 | 4 > 2 |
| The Blighted Valkyrie | boss | 19 > 5 | 2/1/0/2/1 | 3/2/1/3/1 | 130 > 116 | 2 > 2 | 5 > 3 |
| Cinder Mantis | minion | 14 > 3 | 1/1/0/0/0 | 2/2/2/1/1 | 75 > 59 | 3 > 2 | 3 > 1 |
| Eclipse Cantor | minion | 14 > 3 | 0/0/0/1/1 | 2/1/1/2/2 | 79 > 50 | 3 > 2 | 3 > 2 |
| The Furnace Saint | boss | 19 > 5 | 2/2/1/1/0 | 3/3/2/1/1 | 182 > 167 | 3 > 3 | 5 > 3 |
| The Hollow Astronomer | boss | 19 > 5 | 2/1/0/2/1 | 3/1/1/3/2 | 137 > 121 | 3 > 3 | 5 > 4 |
| The Ashheart Dragon | boss | 19 > 5 | 2/1/1/2/0 | 3/2/1/3/1 | 139 > 116 | 2 > 2 | 5 > 3 |

Enemies given `stats.spFloor` so they can pay their dearest card: marrowOrganist (3), blightedValkyrie (2), ashheartDragon (2).
