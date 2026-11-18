# Codex art buildout survey, 2026-11-18

Owner task (2026-11-18): give every new Codex enemy and weapon asset real, playable content. This is the step 1 survey on `feature/CodexArtBuildout`.

## Method

- Diffed the asset ids in `art-manifest.json` from the v26-era pin (0004281, 2026-10-31) against `origin/dev` (v27, 8f9c834). The only new ids are `assets/recipient-effects/v5/*`. Those are combat VFX that are already wired, so they are out of scope.
- Matched every card-art id (`reviewed-library.json`, `reviewed-assets.json`, `extended-manifest.json`, `layered-runtime.json`), every equipment icon and `weapon_*` sprite, and every enemy pose and atlas id against the content registry: the enemy packs, `cards.json`, `enemyCards.json`, gear, and `content/source/weapons.csv`/`outfits.csv`.
- Read the Codex enemy catalog, `asset-data/enemy-concepts/manifest.json`. It is in open PR #2842 (`chore/ConceptEnemyArtIntegration`) and is not on `dev` yet.

## Findings

1. **The new Codex art is 32 enemy concepts, and no weapons.** Each concept has 18 frames: idle, six stance holds, attack/react/defend two-frame clips and downed. They live only in `cehinds/AI-Art` (`pose-studio/enemy-expansion-2026-11-18`). They are not in the pinned art release v27, so a build draws each concept's name placeholder until a release that contains them is pinned.
2. **No new card or weapon art exists on `dev`.** All 237 extended, 175 reviewed and 44 layered card-art ids, all 24 `weapon_*` sprites and all armour art are already used.
3. **Older unused art:**
   - `icon_straightSword` and `icon_kiteShield` were superseded by their *Inventory2026* icons.
   - `assets/animations/reaver/greatsword-v2/*` is unreferenced.
   - `assets/animations/player-attacks/*` (128 frames) is turned off by `DEFAULT_COMBAT_WEAPONS`.
   - Ten legacy `assets/cards/*-512/1024` ids are shadowed by extended art.
   
   None of this is new Codex content, so it is out of scope.
4. **Gap in the other direction:** `shortbow` resolves to `assets/equipment/icon_shortbow.webp`, which no release contains.
5. **Frame names differ.** The concept frames are named `stance-*`, `attack-0N`, `react-0N`, `defend-0N` and `downed`. The shipped expansion stage (`src/ui/enemyExpansionStage.js`, `src/content/enemyExpansion.js`, `enemyStanceSprites.js`) expects `block-01`, `sweep-01`, `preparing` and so on. Showing the concepts needs a frame map in the content data, with no stance-code change.

## Table

| Asset | Intended enemy / card / item | State |
|---|---|---|
| `assets/enemy-poses/expansion/brackenTusker/*` (18 frames) | Bracken Tusker (`brackenTusker`) — normal, weald | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/fenwickToad/*` (18 frames) | Fenwick Toad (`fenwickToad`) — normal, weald | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/reedpipePoacher/*` (18 frames) | Reedpipe Poacher (`reedpipePoacher`) — normal, weald | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/wickerTitheman/*` (18 frames) | Wicker Titheman (`wickerTitheman`) — normal, weald | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/quarryRam/*` (18 frames) | Quarry Ram (`quarryRam`) — normal, marches | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/tollgateHookman/*` (18 frames) | Tollgate Hookman (`tollgateHookman`) — normal, marches | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/waxsealBailiff/*` (18 frames) | Waxseal Bailiff (`waxsealBailiff`) — normal, marches | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/kilnshellTortoise/*` (18 frames) | Kilnshell Tortoise (`kilnshellTortoise`) — normal, reach | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/slagtongImp/*` (18 frames) | Slagtong Imp (`slagtongImp`) — normal, reach | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/sootwingBat/*` (18 frames) | Sootwing Bat (`sootwingBat`) — normal, reach | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/siltCrownNewt/*` (18 frames) | Silt-Crown Newt (`siltCrownNewt`) — elite, weald | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/wickerHind/*` (18 frames) | Wicker Hind (`wickerHind`) — elite, weald | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/blackrushStork/*` (18 frames) | Blackrush Stork (`blackrushStork`) — elite, weald | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/pearlbackSnail/*` (18 frames) | Pearlback Snail (`pearlbackSnail`) — elite, weald | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/alderMaskHarvester/*` (18 frames) | Alder Mask Harvester (`alderMaskHarvester`) — elite, weald | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/pallidOathCamel/*` (18 frames) | Pallid Oath Camel (`pallidOathCamel`) — elite, marches | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/inkveilNautilus/*` (18 frames) | Inkveil Nautilus (`inkveilNautilus`) — elite, marches | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/mirrorFanAbbess/*` (18 frames) | Mirror-Fan Abbess (`mirrorFanAbbess`) — elite, marches | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/saltChoirWalrus/*` (18 frames) | Salt Choir Walrus (`saltChoirWalrus`) — elite, marches | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/rimewheelPenitent/*` (18 frames) | Rimewheel Penitent (`rimewheelPenitent`) — elite, marches | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/brassThroatIbex/*` (18 frames) | Brass-Throat Ibex (`brassThroatIbex`) — elite, reach | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/kilnbackTerrapin/*` (18 frames) | Kilnback Terrapin (`kilnbackTerrapin`) — elite, reach | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/slagwingHeron/*` (18 frames) | Slagwing Heron (`slagwingHeron`) — elite, reach | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/ashSilkWeaver/*` (18 frames) | Ash-Silk Weaver (`ashSilkWeaver`) — elite, reach | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/ferrumVotary/*` (18 frames) | Ferrum Votary (`ferrumVotary`) — elite, reach | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/woundwoodTusker/*` (18 frames) | Woundwood Tusker (`woundwoodTusker`) — boss, weald | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/mireProcessional/*` (18 frames) | Mire Processional (`mireProcessional`) — boss, weald | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/veiledJusticiar/*` (18 frames) | Veiled Justiciar (`veiledJusticiar`) — boss, marches | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/sixleggedHearse/*` (18 frames) | Sixlegged Hearse (`sixleggedHearse`) — boss, marches | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/crucibleNewt/*` (18 frames) | Crucible Newt (`crucibleNewt`) — boss, reach | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/carrionHeadsman/*` (18 frames) | Carrion Headsman (`carrionHeadsman`) — role unassigned, seat unassigned | Concept art outside the pinned release (v27); no enemy definition |
| `assets/enemy-poses/expansion/knellcapSentinel/*` (18 frames) | Knellcap Sentinel (`knellcapSentinel`) — role unassigned, seat unassigned | Concept art outside the pinned release (v27); no enemy definition |
| `assets/recipient-effects/v5/*` | Combat VFX | Wired; out of scope |
| (none) | New weapons or weapon cards | No new weapon art found on `dev` or in v27 |

## Open owner questions

See the PR body. The questions are: an art release with the concepts, the seats and roles for Carrion Headsman and Knellcap Sentinel, and whether any Codex weapon art exists outside `dev`.
