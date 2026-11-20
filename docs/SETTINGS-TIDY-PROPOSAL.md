# Settings tidy: Advanced and Combat proposal

Survey only (2026-11-20). Nothing here is moved or deleted yet. The owner decides.

- Source: `SETTINGS_ROWS` (`src/ui/models/SettingsRowsModel.js`), Core 2 visibility from
  `settingsRowAvailable` (`src/ui/models/SettingsCapabilitiesModel.js`), readers from
  `git grep -w <key> -- src styles` (row table and strings left out).
- **Core 2** column: `shown` = drawn in the only game mode; `hidden` = Core 2 never draws it.
- **Who**: `player` = a normal player might change it; `tester` = QA or the owner checking
  something; `author` = content or layout tuning.

## What is there today

- **Advanced**: 62 hand-made rows in 10 row groups, plus 836 generated `gameConfig.*` rows
  (834 under Opening, 2 under Interface). Sync, Changelog and About are panels, not rows.
- Release builds show only **Deck, Interface, Text, Changelog, About**. Everything else is
  dev and test only (`RELEASE_ADVANCED_GROUP_IDS`).
- Core 2 hides **Progression, Rewards, Deck (except Play in deck order), Equipment, World**.
  Their values still apply: the code reads them, but nobody can change them in Core 2.
- **Combat**: 24 rows in 5 topics, plus 12 rows inside the Effects modal.

## Advanced rows

| Key | Label | Group | Default | Core 2 | Who |
|---|---|---|---|---|---|
| ambient | Ambient effects | Interface | normal | shown | player |
| useRestorativeFlasksOutsideCombat | Use flasks outside combat | Interface | true | shown | player |
| walkedFade | Walked nodes | Interface | half | shown | player |
| cardMotif | Card motif | Interface | wash | shown | player |
| cardMotifStrength | Motif strength | Interface | normal | shown | player |
| controlHints | Control hints | Interface | true | shown | player |
| mapFreePan | Two-axis map dragging | Interface | true | shown | player |
| mapHeaderDensity | Map header | Interface | compact | shown | player |
| mapHeaderRelics | Relics in map header | Interface | true | shown | player |
| uprightGate | Short-screen warning | Interface | false | shown | player |
| holdConfirm | Hold to confirm | Interface | normal | shown | player |
| rewardCollect | Reward collection | Interface | manual | shown | player |
| (2 generated) | Settings panel width / height | Interface | 100 / 100 % | shown | tester |
| loreFace | Typeface | Text | fell | shown | player |
| loreSize | Size | Text | M | shown | player |
| loreLeading | Line spacing | Text | normal | shown | player |
| loreTracking | Letter spacing | Text | normal | shown | player |
| loreSlant | Lore slant | Text | italic | shown | player |
| loreIdentitySlant | Identity line slant | Text | italic | shown | player |
| deckEditing | Deck editing | Deck | true | hidden | author |
| deckEditingWhere | Where you can edit | Deck | free | hidden | author |
| deckMinUnlimited | No minimum deck size | Deck | false | hidden | author |
| deckMinSize | Minimum deck size | Deck | 10 | hidden | author |
| deckMaxUnlimited | No maximum deck size | Deck | true | hidden | author |
| deckMaxSize | Maximum deck size | Deck | 40 | hidden | author |
| classSpellPowerCopies | Copies of a class spell or Power | Deck | 1 | hidden | author |
| playInDeckOrder | Play in deck order | Deck | false | shown | player |
| creationAutoAdvance | Auto-advance character creation | Progression | false | hidden | tester |
| levelUpValue | Level-up value | Progression | 1 | hidden | author |
| victorySummaryMode | Open full Victory summary | Rewards | continue | hidden | player |
| victoryReceiptSeconds | Victory XP breakdown (seconds) | Rewards | 1 | hidden | author |
| victoryReceiptPauseMs | Pause between XP lines (ms) | Rewards | 80 | hidden | author |
| victoryReceiptReadySeconds | Continue ready delay (seconds) | Rewards | 0.5 | hidden | author |
| victoryReceiptFormulaTerms | XP terms before +… | Rewards | 5 | hidden | author |
| victoryReceiptVisibleRows | Visible XP breakdown rows | Rewards | 4 | hidden | author |
| victoryXpSeconds | Victory XP animation (seconds) | Rewards | 3 | hidden | author |
| rewardLevelStatPoints | Level Up · Stat points | Rewards | true | hidden | author |
| rewardLevelCards | Level Up · Bonus card | Rewards | false | hidden | author |
| shopSell | Merchant buys back | Rewards | true | hidden | author |
| swapCostRule | Weapon swap cost | Equipment | flat | hidden | author |
| shrineMultiUse | Multi-use Shrines | World | true | hidden | author |
| cardWidth_glance | Resting card width | Wireframes | 182.4 | shown | author |
| cardWidth_glance_mobile | Resting card width, phone | Wireframes | 170 | shown | author |
| cardWidth_focus | Selected card width | Wireframes | 336 | shown | author |
| cardWidth_inspect | Reading card width | Wireframes | 384 | shown | author |
| cardSizeExport | Export card sizes | Wireframes | (button) | shown | author |
| wireframeModalWidth | Modal window width | Wireframes | auto | shown | author |
| wireframeModalFooter | Modal footer buttons | Wireframes | auto | shown | author |
| wireframeMenuNav | Category navigation | Wireframes | auto | shown | author |
| wireframeMenuFrame | Workspace frame | Wireframes | auto | shown | author |
| wireframeSceneSkyline | Scene backdrop | Wireframes | auto | shown | author |
| wireframeSceneFloor | Scene ground line | Wireframes | auto | shown | author |
| prologueSceneList | The opening, in order | Opening | (list) | shown | author |
| prologuePreview | Preview opening | Opening | (button) | shown | author |
| prologueSceneExport | Export scene configuration | Opening | (button) | shown | author |
| prologueSceneImport | Load scene configuration | Opening | (button) | shown | author |
| (834 generated) | Per-scene art and layout | Opening | authored | shown | author |
| musicFolder | Custom music folder | Export | "" | shown | player |
| debugMode | Debug mode | Export | false | shown | tester |
| commandLog | Command log | Export | (button) | shown | tester |
| promptSettingsExport | Offer export when done | Export | true | shown | tester |
| gameConfigExport | Export game configuration | Export | (button) | shown | tester |
| gameConfigImport | Load game configuration | Export | (button) | shown | tester |

## Combat rows

| Key | Label | Topic | Default | Core 2 | Who |
|---|---|---|---|---|---|
| autoCombat | Auto combat | Auto combat & pacing | false | shown | player |
| combatSpeed | Combat speed × | Auto combat & pacing | 1.25 | shown | player |
| combatPreference | Auto combat preference | Auto combat & pacing | offense | shown | player |
| autoCombatSpeed | Auto combat speed × | Auto combat & pacing | 1.5 | shown | player |
| combatStepPause | Pause between steps (ms) | Auto combat & pacing | 500 | shown | tester |
| animationStepDuration | Animation step duration (ms) | Auto combat & pacing | 550 | shown | tester |
| enemyAttackMs | Enemy attack animation (ms) | Auto combat & pacing | 750 | shown | tester |
| enemyFloaterIntervalMs | Enemy floater interval (ms) | Auto combat & pacing | 750 | shown | tester |
| combatPacingPreset | Combat pacing preset | Auto combat & pacing | custom | shown | player |
| animSpeed | Combat pacing | Auto combat & pacing | auto | shown | player |
| askToUpcastAfterTarget | Ask to upcast after choosing a target | Animation & effects | false | hidden | player |
| useSprites | Character sprites | Animation & effects | true | shown | tester |
| effectsMenu | Effects (opens the modal) | Animation & effects | (button) | shown | player |
| showPlayedCard | Show played card animation | Animation & effects | false | shown | player |
| manaRing | Mana ring | Animation & effects | true | only with Mana | player |
| combatLogConsole | Console button in combat log | Combat log | false | shown | tester |
| combatLogPlayerColor | Player name color | Combat log | #7fc4ff | shown | player |
| combatLogEnemyColor | Enemy name color | Combat log | #ff8d83 | shown | player |
| rangeMechanics | Range mechanics | Range | true | shown | author |
| rangeAdvanceSpPerBand | Advance Stamina per band | Range | 1 | shown | author |
| rangeReachPrecisionBonus | Reach at Melee: Precision bonus | Range | 1 | shown | author |
| rangeThrowPrecisionPenalty | Throw: Precision penalty | Range | 1 | shown | author |
| armamentsPresentation | Combat Armaments | Armaments | radial | shown | player |
| armamentsPhonePlacement | Phone Armaments location | Armaments | left | shown | player |

Effects modal (12, already grouped, no change proposed): effects, fxGlow, fxSparks, fxFlash,
screenShake, fxHitStop, motionAttack, motionHit, motionIdle, motionDefeat, fxBlur, fxShadows.

## Proposed regrouping

### Combat (24 → 12 shown by default)
- **Keep, player-facing**: Auto combat, Auto combat preference, Combat pacing, Effects,
  Show played card, Mana ring, Armaments (2), Combat log colours (2).
- **Merge the two speed rows**: Combat speed × and Auto combat speed × sit side by side; one
  "Speed" row with a manual / auto pair would read better.
- **Behind a "More" toggle in Auto combat & pacing**: Pause between steps, Animation step
  duration, Enemy attack animation, Enemy floater interval, Combat pacing preset. They are
  millisecond tuning; Combat pacing already picks a preset.
- **Move to Developer (dev and test only)**: Character sprites, Console button in combat log.
- **Move Range to Advanced (author)**: the four Range rows change the next run's rules, not
  how combat looks. They fit with other rules tuning.
- **Rename the topic "Animation & effects"**: after the Effects modal took the visual rows,
  it holds Effects, played card, mana ring and the upcast prompt. "Cards & effects" fits.

### Advanced
- **Interface (12) splits in two**: *Map* (Walked nodes, Two-axis map dragging, Map header,
  Relics in map header) and *Interface* (the rest). Map rows could also join General ›
  Display › Map, which already exists.
- **Ambient effects**: it already shows in the Effects summary ("5 of 6"). Move the row into
  the Effects modal so the count and the switch live together.
- **Merge Wireframes into a Developer group with Export**: all 11 are author layout dials
  plus card-size export; none is a player choice.
- **Opening**: keep as is (author tool, dev and test only).

### Hidden in Core 2 but still read (looks dead to a player)
Rows Core 2 never draws, whose stored value or default still applies:

| Rows | Read by | Suggestion |
|---|---|---|
| Rewards: victory pacing (6), Open full Victory summary | `ui/screens/reward.js`, `model/victoryXpPresentation.js` | Make the defaults authored content; drop the rows |
| Rewards: Level Up · Stat points / Bonus card | `main.js:1456` (character sheet offers) | Same |
| Rewards: Merchant buys back | `ui/screens/shop.js`, `model/secondbeat.js` | Same |
| Deck: editing and size limits (7) | `model/deckRules.js`, `content/deckRules.js` | Already authored in `content/deckRules.js`; drop the rows |
| Progression: Level-up value | `model/advancedConfig.js` | Same |
| Progression: Auto-advance character creation | `ui/screens/customize.js` | Move to Developer (a QA shortcut) |
| Equipment: Weapon swap cost | engine combat + loadout (8 files) | Rules; keep as authored content, drop the row |
| World: Multi-use Shrines | `main.js:2435` (rest visit) | Same |
| Combat: Ask to upcast after choosing a target | `ui/screens/combat.js` | Core 2 hides it for good; drop the row |

### Looks unused
- None of the 86 surveyed keys has zero readers. The `cardWidth_*` rows show 0 hits for
  the plain key because `ui/models/CardSizeModel.js:411` builds the key
  (`cardWidth_${level}`); they are live.
- The real dead weight is the 22 rows Core 2 cannot reach (table above): live code, but
  no way to change them in the only game mode.

## data-performance vs data-effects

Not merged. At runtime they are the same fact; one module and its test treat them as two.

- **Set**: only `src/ui/displaySettings.js:511-516`, in one call, from one predicate:
  `data-performance` = `resolvePerformanceMode()` = Effects on ? `full` : `lite`;
  `data-effects` = Effects on ? `on` : `off`. The touch-device argument is ignored, and the
  Blur / Shadows Auto rule uses its own `data-fx-blur` / `data-fx-shadows` plus
  `data-layout` / `data-form-factor`. So in the game, `lite` always means `off`.
- **Read as `data-performance`**: `ui/performance.js` `liteRendering()` (used by
  `alternativeCardStage.js`, `reaverAttack.js`, `services/posePreloads.js`),
  `components/battlefieldStage.js:656`, the art cache keys in `screens/combat.js:2244, 2434`,
  and about 60 CSS selectors (`perf-lite.css`, `kit.css`, `map.css`, `combat*.css`, ...).
- **Read as `data-effects`**: `ui/performance.js` `effectsOff()` / `FxOff()`,
  `battlefieldStage.js:1735`, and the Effects-off CSS in `combat.css`, `kit.css`, `ui.css`,
  `combat-visuals.css`.
- **Where they differ**: `src/ui/alternativeCardStage.js:118-120` has three paths: glow off
  (held still glow), Lite (no aura canvas, red hit mask kept), Standard. The Lite path runs only
  when `data-performance="lite"` and Effects is on, which the game never sets.
  `tests/alternative-card-stage.test.mjs:56-70` sets exactly that and asserts the Lite path.
- Merging the hooks (tried, then reverted on this branch) makes that path unreachable and fails
  that test. Keeping one hook means deleting the Lite path and its test segment.

## Decisions needed
- data-performance: drop it and delete the unreachable Lite path in `alternativeCardStage.js` with its test lines? (yes/no)
- Combat: OK to hide the 5 millisecond rows behind "More" and move Sprites and Console to Developer? (yes/no)
- Range: move the 4 rows to Advanced? (yes/no)
- Core 2 hidden rows: drop them and keep their defaults as authored content? (yes/no)
- Advanced: split Interface into Map + Interface, and fold Wireframes into Developer? (yes/no)
