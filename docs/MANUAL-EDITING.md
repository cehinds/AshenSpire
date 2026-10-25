# Editing AshenSpire

Two parts, one page:

1. [Changing game content (`content/source/`)](#changing-game-content-contentsource): the shared content every game reads, as a "to change X, edit Y" table, with the five-step workflow, JSON basics, what stays code and the common mistakes.
2. [Visual Studio, game packs and recipes](#part-2--editing-ashenspire-without-an-agent): the Core game pack, interface layout and timing, named icons.

**Read this first: which file wins.** The default player game is **Core**. Core
installs its own pack, `games/ashenspire/packs/core/`, on top of the shared
content, and for the things below the pack's file wins. Edit those in the pack
([Core: edit the active game pack first](#core-edit-the-active-game-pack-first)),
then run `node tools/game-config.mjs build` and `node tools/game-config.mjs check`.

| In Core, this comes from the pack | Pack file |
| --- | --- |
| The cards in a Core deck (ids starting `core.`, such as `core.strike` and the class specials) | `cards.json`, costs in `resourceVariants.json`, pools in `cardPools.json` |
| A class's starting attributes, deck, equipment, special card and description | `characters.json` (and `starterDeck.json`) |
| How attributes turn into HP, draw and the rest in Core | `stats.json` |
| Enemy attributes, decks, behavior, boss phases and starting Poise | `characters.json` |
| Enemy attacks and per-hit damage | `enemyCards.json` |
| Base reward cards and their statuses | `games/ashenspire/packs/base-cards/cards.json`, `statuses.json` |
| Map routes, rest services, shop offers, victory reward offers, class unlocks | `routes.json`, `rests.json`, `shops.json`, `rewards.json`, `classUnlocks.json` |
| Minimum stats to equip gear | none: Core switches equipment requirements off |

The rest (encounters, events, relics, items and equipment, progression,
balance numbers, interface text and the other tables in Part 1) comes from the
shared content in Part 1, in Core too. If an edit in Part 1 does not show up in
Core, check the table above and Part 2 for a pack file that owns it.

## Changing game content (`content/source/`)

Game content is JSON and CSV files in `content/source/`. You edit those, never the
JavaScript under `src/content/`. `node tools/content-build.mjs` compiles them into
`src/content/generated/`, which you never touch by hand. Design notes for each file
are in `content/source/CONTENT-NOTES.md`.

### To change... edit this file

Paths are inside `content/source/` unless they start with `src/`.

#### Cards and classes

| To change... | Edit this file | Notes |
| --- | --- | --- |
| Reaver, Starseer, Herald or Rogue cards | `cards/reaverCards.json`, `cards/starseerCards.json`, `cards/heraldCards.json`, `cards/rogueCards.json` | One row per card: cost, type, rarity, effects, text, upgrade. Copy a nearby row for a new card. |
| Cards any class can find; corrupted cards; weapon cards | `cards/colorlessCards.json`, `cards/corruptedCards.json`, `cards/armamentCards.json` | Weapon cards are mounted on a weapon by `weaponCardPackages.json`. |
| Extra spells and counters added for combat expansion | `cards/combatExpansionNewCards.json` | Same card shape as above. |
| Which cards a weapon gives | `weaponCardPackages.json`, `basicCardProfiles.csv`, `cardEquipmentExceptions.csv` | Basic strike/guard cards follow the weapon's profile. |
| Whether a card deals fire, frost and so on | `cardExposure.csv` | One row per card that carries a damage school. |
| Mana rules for spell cards | `cardManaPolicy.json` | Which cards must cost Mana. |
| A class's HP, starting relic, flasks, card pool | `classes.json` | Four classes: reaver, starseer, rogue, herald. In Core the pack sets HP, deck and special card. |
| What a class starts with | `startingKits.csv` | One free baseline kit per class. Core uses the pack's `starterDeck.json` and `characters.json`. |
| Keyword tooltips (Exhaust, Retain...) | `keywords.json` | Five rows. Names and tooltip text only. |
| What a status does (Bleed, Burn...) | `statuses.json` | 56 rows. Stack mode, decay, tooltip. Expansion statuses are code; base-card statuses in Core are in the base-cards pack. |
| Stances | `stances.json` | Three rows. |

#### Enemies, encounters, events

| To change... | Edit this file | Notes |
| --- | --- | --- |
| An enemy's HP, attributes, moves | `act1Enemies.json`, `act2Enemies.json`, `act3Enemies.json` | One file per act, eleven enemies each. Core's enemy decks, attacks and Poise are in the pack. |
| Which enemies appear together, per region | `wealdEncounters.json`, `marchesEncounters.json`, `reachEncounters.json` | One row per fight: enemies, weight, pool, floor band. |
| Boss tougher or easier by tier | `balanceBossTiers.json`, `balanceSeatTiers.json` | See the balance table below. |
| Event text and choices | `events.json` | Choice ids go in `eventChoiceIds.json`, same length as the choices. |
| Who speaks an event line | `eventSpeakers.json`, `speakers.csv` | |
| Event gates and quest chains | `eventHistoryRequirements.json`, `eventChoiceHistoryRequirements.json`, `questChains.json` | |
| Map, towns, regions | `worldAtlas.json`, `locationPresentation.json` | Weather, music and scenes per place. |
| Old-style dungeons | `legacyDungeons.json` | |

#### Shops, items, companions

| To change... | Edit this file | Notes |
| --- | --- | --- |
| What shops sell and how often | `shops.json` | Prices and stock sizes are in `balanceShop.json`. Core's shop offers are the pack's `shops.json`. |
| Consumable books and tokens | `consumableBooks.json`, `consumableTokens.json` | Class skill books are also made from `classes.json`. |
| Flasks (potions) | `flasks.json` | Seven rows. |
| Relics | `relics.json` | The relic's combat effect is a separate rule: a row in `nodes.csv`, `nodeEffects.json` and `tagging.csv` that shares the relic's id. |
| Companions | `companions.json` | Two rows. |
| Weapons, shields, staves | `weapons.csv` | One row each. |
| Armour sets | `outfits.csv` | |
| Slots, modifiers, what a card modifier rewrites | `equipSlots.csv`, `equipMods.csv`, `equipTargets.csv` | The words a modifier may use. |
| Cards a piece carries | `equipmentGrants.csv` | |
| Minimum stats to equip | `equipmentRequirements.csv` | Core switches these off. |
| Smithing upgrades per tier | `itemUpgradeChanges.csv` | One row is one number change. |
| The Armoury screen layout | `armouryUi.json` | |

#### Characters and stats

| To change... | Edit this file | Notes |
| --- | --- | --- |
| The five attributes | `attributes.json` | Names and short names. |
| Point-buy presets | `attributeRules.json` | |
| Character creation screen, keepsakes | `characterCreation.json`, `creationModes.json` | Modes: starting points, minimum, maximum. |
| What each stat turns into (HP, Actions, Draw...) | `derivedStatRules.json` | |
| Action costs of cards and drawbacks | `actionCosts.json` | The cost table and its budget. |
| Poise, ward and counter rules | `fixCoreMechanics.json` | |

#### Progression

| To change... | Edit this file | Notes |
| --- | --- | --- |
| Card families (the ability ladder) | `progressionCardFamilies.json` | 40 rows. Lore text is in `progressionCardLore.json`. |
| Lessons (how abilities are learned) | `progressionLessonRecipes.json` | |
| Feats and what unlocks them | `progressionFeatRows.json`, `progressionFeatUnlocks.json` | Feat descriptions are computed. See "What is still code". |
| Progression relics | `progressionRelics.json`, `progressionRelicUnlocks.json` | |
| What a class unlocks at each level | `progressionUnlockRows.json`, `unlocks.csv` | |
| Gear needed at each level | `progressionGearRequirements.json` | |
| Grade budget for abilities | `progressionGradeRules.json` | The maths using it is code. |
| Class mastery levels and rewards | `classMastery.csv`, `balanceClassMastery.json` | |
| The class talent tree | `classTree.csv`, `familyNodes.csv`, `balanceClassTree.json` | |

#### Balance numbers (one file per topic)

| To change... | Edit this file | Notes |
| --- | --- | --- |
| Start of a run: draw, flasks, starting Cinders, deck size | `balanceCore.json` | Some rows say they are unused; the `$note` says so. |
| Costs a card pays when it names a resource | `balanceCosts.json`, `balanceMana.json` | Stamina, Mana and Actions floors. |
| Minimum deck size | `balanceDeck.json` | Rises with character level. |
| Rewards after fights: card choices, Cinders, rarity odds, flask drops | `balanceRewards.json` | Core's reward offers are the pack's `rewards.json`. |
| Shop stock sizes, prices, selling | `balanceShop.json` | |
| Rest sites: how much HP a camp or shrine heals | `balanceRest.json` | Core's rest services are the pack's `rests.json`. |
| XP from wins and kills | `balanceXp.json` | |
| Character level-up points and level cap | `balanceLevelUp.json`, `balanceLevels.json` | |
| Skills: drafts, ranks, feat rhythm | `balanceSkill.json`, `balanceProgression.json` | |
| Feat and progression-relic numbers | `balanceProgressionFeats.json`, `balanceProgressionRelics.json` | |
| Relic powers (Forsaken Medallion and the rest) | `balancePowers.json` | |
| Sigils: strength, drop chance | `balanceSigils.json` | |
| Equipment: swapping, mounts, rarity bonuses | `balanceEquipment.json`, `balanceCustomMods.json` | Custom Climb options are in the second. |
| Smithing stones and services | `balanceSmithing.json` | |
| Poise and stagger | `balancePoise.json`, `balanceStagger.json` | |
| Spell exposure and breaks | `balanceExposure.json`, `balanceArcaneExposure.json` | |
| Oath and other tag effects | `balanceTagMechanics.json` | |
| Boss and seat strength by tier | `balanceBossTiers.json`, `balanceSeatTiers.json` | |
| Endless Spire scaling | `balanceEndless.json` | HP and Strength added each loop. |
| Co-op, gauntlet test | `balanceCoop.json`, `balanceGauntlet.json` | Co-op is off in the current player flow. |
| Map size limits | `balanceAtlas.json` | |
| Interface sizes, HUD, tooltips, accents | `balanceUi.json` | |

#### Combat expansion tables

| To change... | Edit this file | Notes |
| --- | --- | --- |
| A spell's school and damage type | `combatExpansionCardOverlay.json`, `combatExpansionSpellProfiles.json`, `combatExpansionCardTables.json` | The projection reading them is code. |
| Martial card roles | `combatExpansionMartialOverlay.json`, `combatExpansionMartialTables.json` | |
| Armour and enemy expansion values | `combatExpansionEquipment.json` | |
| Counter text | `combatExpansionLore.json` | |

#### Words, tags and everything else

| To change... | Edit this file | Notes |
| --- | --- | --- |
| Any sentence the interface says | `uiStrings.csv` | Three lengths per id: `short`, `full`, `tip`. |
| Rules attached to tags (the tag tree) | `nodes.csv`, `nodeEffects.json`, `nodeRelations.csv`, `nodeTerms.csv`, `nodeVariables.csv`, `variableBindings.csv`, `tagFamilies.csv`, `tagging.csv` | Advanced. `tagging.csv` is 4,000 lines: who carries which tag. |
| Interface layout, sizes, timings | `content/config/ui/` | Different build: `node tools/config-build.mjs`. See Part 2. |

### Workflow

1. Edit the JSON or CSV file. Change one thing first.
2. Run `node tools/content-build.mjs`. One run is enough. It rewrites `src/content/generated/`.
3. Run `node tools/content-build.mjs --check`. It must finish with no error message.
4. Preview: `node tools/serve.mjs`, then open http://localhost:8080. `node tools/launch.mjs` also works and builds first (`npm start` does the same).
5. Commit (see CONTRIBUTING.md, "Commits & PRs"):
   - small commits, imperative subject of at most 72 characters;
   - commit the source file and the regenerated files that go with it;
   - never commit built HTML, and do not edit `CHANGELOG.md` or `buildordinal.json` by hand;
   - work on a branch and open a pull request into `dev`.

### JSON basics

- Text goes in double quotes: `"name": "Ember Hew"`. Single quotes are an error.
- Numbers have no quotes: `"cost": 2`. `"2"` is text, not a number.
- Every entry except the last in a list or object ends with a comma. The last one has no comma (a trailing comma is an error).
- Lists use `[ ... ]`, objects use `{ ... }`. Each must close.
- CSV files: keep the header row. Quote any cell containing a comma. Lines starting with `#` are comments.
- `"$note"` holds an explanation for the value beside it. It becomes the sentence shown for that number in Settings → Advanced (see `src/model/balanceNotes.js`). Keep a note accurate when you change its number.
- Keep ids unique and do not rename ids. Saves store them (a saved combat holds each card as a `cardId`, in `src/engine/combat.js`), and the game refuses two entries with the same id (`Duplicate id` in `src/model/validate.js`). To retire something, change what it does rather than its id.

### What is still code, and why

A few things are computed, so they cannot be a plain table. Ask a developer to change them.

| Still code | Why | Ask about |
| --- | --- | --- |
| The damage rule template (one template for five card kinds) | Its status list is derived from the other status rows. | `src/content/balance.js` |
| Gear sentences in the progression notes | Written from the gear requirement rows. | `src/content/balance.js` |
| Delays derived from tooltip settings (`hoverDelayMs`) | Computed from other settings. | `src/content/balance.js` |
| Ability grade maths | A formula, not a list. | `src/model/abilityGrades.js` |
| Feat descriptions | Built from balance numbers, tags and variable bindings. | `src/content/progression/feats.js` |
| Spell and martial "apply" functions | Real logic reading the expansion tables. | `src/content/combatExpansionCards.js`, `src/content/combatExpansionMartial.js` |
| Expansion statuses | Derived from rules. | `src/content/combatStatusRules.js` |
| Equipment lookups | Normalises the CSV tables into lookups. | `src/content/equipment.js` |
| Co-op-only cards | Still written in a code file (co-op is off in the current player flow). | `src/content/cards/coop.js` |
| Art, pose and landmark tables | Generated by the art tools. | `src/content/poseSprites.js`, `src/content/mapArt.generated.js` |

### Common mistakes and what you will see

Every message starts with `content-build: `.

| Mistake | Message |
| --- | --- |
| Broken JSON (comma, quote, bracket) | `<file>: <JSON error text>` |
| A card file that is not a list | `cards/<file>: a card pool is a JSON array of card rows` |
| CSV row with the wrong number of cells | `<file>: row N has X cells, header has Y` |
| Repeated CSV column name | `<file>: duplicate column '<name>'` |
| CSV with no rows | `<file>: no data rows` |
| Weapon with a bad range | `weapons.csv: row N ('<id>') has range '...' — every armament names one of ...` |
| Node with an unknown parent | `nodes.csv: '<id>' names parent '<x>', which is not a node` |
| A rule for a node that does not exist | `nodeEffects.json: '<id>' is not a node` |
| Variable with no binding | `nodeEffects.json: '<id>' reads variable '<v>', which has no default binding in variableBindings.csv` |
| Binding pointing at a missing balance number | `variableBindings.csv: '<node>.<variable>' names balance row '<path>', which is not a number in src/content/balance.js` |
| A new file the compiler does not know | `stray source file(s) the compile will never read:` |
| You forgot step 2 | `N generated file(s) are out of date — run: node tools/content-build.mjs` |
| You deleted a source file | `orphaned generated file(s) with no source: ... — delete them or restore their source` |

Other checks (unknown fields, duplicate ids, bad references) run in the game's tests
rather than the compiler. After any edit, run `node tools/content-build.mjs --check`
and `npm test`, or the test command in DEVELOPER.md.

---

## Part 2 — Editing AshenSpire without an agent

Open the repository folder in Visual Studio (**File → Open → Folder**).
No solution conversion is needed. Install Node 22.14 or newer. Right-click
`package.json` for the **AshenSpire** tasks defined in `tasks.vs.json`.
Use **Serve without opening a browser** for the source game, then open the
printed local URL. **Build standalone** creates the portable game and stamps a
build; run it when ready to package your changes.

## Core: edit the active game pack first

The default player game is **Core**. Its authored selection is
`games/ashenspire/game.json`, which selects
`games/ashenspire/bundles/core/bundle.json`. That bundle installs both
`games/ashenspire/packs/core/pack.json` and `packs/base-cards/pack.json`.
Edit these source files for the Core player flow:

| Change | Core source owner |
| --- | --- |
| Basic player card costs, effects, text and named icons | `games/ashenspire/packs/core/cards.json` |
| Base reward cards and statuses | `games/ashenspire/packs/base-cards/cards.json` (`definition`), `statuses.json`; preserve each frozen `provenance.sourceProposal` |
| Equipment and its modifiers | `games/ashenspire/packs/core/gear.json` |
| Enemy attacks and per-hit damage | `games/ashenspire/packs/core/enemyCards.json` |
| Player/enemy attributes, decks, behavior and boss phase hooks | `games/ashenspire/packs/core/characters.json` |
| Card pools, starting hands, routes, rewards, shops and rests | Matching JSON in `games/ashenspire/packs/core/` |
| Class and weapon XP rates | `games/ashenspire/bundles/core/bundle.json` → `modules.progression.settings.classXpMultiplier` / `weaponXpMultiplier` |
| Step gaps, animation duration and playback | `content/config/ui/presentation/actionPacing.json` → `motion` and `behavior` |

The Visual Studio **Compile Core game profiles**, **Check Core game profiles**
and **Build game artifact** tasks run these commands.
After pack or bundle edits run `node tools/game-config.mjs build`, then
`node tools/game-config.mjs check`. The compiler regenerates the catalog,
base-card projection and compatibility lock; do not hand-edit these outputs or
relax compatibility checks to accept them. Then run `node tools/build-game.mjs`
and `node tools/build-game.mjs --check` to refresh/check the derived game artifact
and summary. This is separate from packaging the standalone HTML. After pacing
edits run `node tools/config-build.mjs` and its `--check`, followed by the game
artifact build/check. Keep generated source/lock/summary changes with their
source edit; the full `dist/build/` artifact is ignored.

### Worked recipe: a real boss attack with three hits

Find `stitchedKing.graspingHands` in Core `enemyCards.json`. Its damage effect
has `amount: 5` and `hits: 3`: three base hits of five, before modifiers. To
retune this attack to four per hit, change only its `amount` to `4`, keeping
`hits: 3` and its parameterized `textTemplate`. Recompile as above and inspect
the boss card plus a real hit receipt. The Stitched King's phase hook in
`characters.json` grants Strength below 50% HP, and gear, ratings, defenses and
statuses can further change each hit. A displayed base 5 × 3 is not a promise
of fifteen HP lost: use the receipt's base/modifier/defense breakdown before
changing the authored base to compensate for an active modifier.

### Worked recipe: XP and pacing defaults

To make Core class training twice as fast, set
`modules.progression.settings.classXpMultiplier` to `2` in the Core bundle;
leave `weaponXpMultiplier` at `1` to preserve weapon training. Rebuild/check
profiles and the game artifact. New runs snapshot the resolved module
settings; existing runs retain their authored snapshot, so verify with a new
run instead of silently changing an old save's compatibility identity.
For a shorter pause between action stages, change `motion.stageGapMs` in
`actionPacing.json` from `500` to `250`; `motion.animationStepDurationMs`
(currently `390`) controls animation steps separately, and
`motion.spritePlaybackRate` controls sprite playback. Compile/check the
presentation config and game artifact. Verify a fresh run with default
settings: saved player settings can override these defaults. Change one timing
at a time and inspect a multi-hit action on desktop and phone.

## Current/legacy content owners

These owners still serve active optional profiles and shared content. They do
not replace the Core pack owners above. A legacy converter can rewrite pack
JSON: review its diff before compiling if you run one deliberately.

| Change | Edit here | Verify |
| --- | --- | --- |
| A base card's costs, effects, text or icon | `content/source/cards/*.json`; co-op additions currently remain in `src/content/cards/coop.js` | Compile authored content; Fast core tests |
| Shared progression ability grades and riders | `src/content/progression/cardFamilies.js`, `cards.js`, `lessons.js`, `cardRecipeText.js` | `node --test tests/progression-card-content.test.mjs` |
| Enemy definitions | `content/source/act1Enemies.json`, `act2Enemies.json`, `act3Enemies.json`; shared expansion owners in `src/content/enemyExpansion.js` | Compile authored content; Fast core tests |
| Weapons, starting kits, mounted cards | `content/source/weapons.csv`, `startingKits.csv`, `weaponCardPackages.json`; shared progression gear in `src/content/progression/gear.js` | Compile authored content; Fast core tests |
| Relics, statuses, flasks, stances | Matching JSON in `content/source/`; expansion rules in `src/content/combatStatusRules.js` | Compile authored content; Fast core tests |
| Progression, experience, unlocks | `src/content/progression/rules.js`, `unlocks.js`, `feats.js`; existing table-driven unlocks in `content/source/unlocks.csv` | Fast core tests; check saved and new runs |
| Balance and rules | `src/content/balance.js`, `combatRules.js`, `actionCosts.js` | Fast core tests; update `SPEC.md` first for contractual changes |
| Animation/hold/tooltip timing | `content/config/ui/tokens.json`, matching component/screen/presentation JSON; follow the importing `src/content/` shim | Compile presentation configuration; Check presentation configuration |
| Layout, sizes, positions and layers | `content/config/ui/scenes/`, `components/`, `screens/`; `styles/kit.css` for shared styling | Compile presentation configuration; check phone and desktop views |
| A label or explanation | `content/source/uiStrings.csv` | Compile authored content |
| Named interface icons | `src/content/uiIcons.js`; authored rows use its readable IDs | Check named icon vocabulary |

The detailed ownership contract is [ARCHITECTURE-MAP.md](ARCHITECTURE-MAP.md).
Compiler instructions and table conventions are also in
[content/source/README.md](../content/source/README.md) and
[content/config/README.md](../content/config/README.md).

## A small, safe editing cycle

1. Save a Git commit or copy the file before editing. Change one item first.
2. Keep IDs unchanged when editing an existing item; saves and references use
   those IDs. For a new item copy a nearby row, give it a unique ID, and update
   any pool, recipe, encounter or loadout that should expose it.
3. JSON requires double quotes and no trailing commas. Preserve CSV headers;
   quote text containing commas and use doubled quotes inside quoted cells.
4. Run **Compile authored content** after changing `content/source/`, or
   **Compile presentation configuration** after changing `content/config/`.
   Their **Check** tasks detect stale projections without writing files.
5. Run **Fast core tests**, serve the source game and inspect the changed item.
   Keep compiler outputs with the source change. Never edit
   `src/content/generated/` or `src/config/generated/` by hand.
6. Package with **Build standalone** when the source game behaves correctly.

Core progression and older authored pools are separate active owners. Check the
selected game profile before deciding that an item is unused. Co-op is disabled
in the current player flow; that does not make its simulation or support code
safe to delete.

## Readable icon IDs

Use `"icon": "attack"` or `glyph: 'shield'`, rather than pasted pictograms.
The central vocabulary lists the existing vector names: `attack` and `sword`
for attacks, `skill` for skills, `health`/`mana`/`stamina`/`actions` for resources,
`shield`/`block`/`armour` for protection, `bleed`/`burn`/`frost`/`blight` for
statuses, and `relic`/`quest`/`progression` for rewards and navigation.
`engravedIconUrl(id)` resolves these names to the existing reviewed SVG assets;
character, enemy, weapon and card paintings retain their existing asset IDs.
`uiIconText(id)` supplies concise text when artwork is unavailable. Escaped
legacy aliases in the central table exist only for old saves/configuration.

## Dormant code

The [archive record](archive/core-renewal/README.md) explains the one verified
inactive presenter retained outside the runtime tree, including its original
path and restoration procedure. An absent text-search result alone is not
proof that another module is unused: inspect imports, dynamic registries,
authored component references, previews, tests and tooling before archiving it.

### Original class and map symbols

Author icon fields with readable IDs from `src/content/uiIcons.js`. `historic-*`
IDs name a fixed whitelist of the original class/location glyphs; their escaped
code points live only in that registry. They do not require new SVG asset files.
Generic vector IDs such as `progression`, `sword` and `madness` keep their existing
artwork. Saved raw-symbol aliases keep their existing generic-ID compatibility;
use an explicit historical ID to request the original glyph rather than an alias.
DOM/HTML icons inherit the caller’s color and box. URL-only consumers receive an
encoded SVG with an explicit gold fill. Map node faces use inline text so their
existing type, reachable and current-state tints still apply. Custom named vector
IDs and custom visual DOM nodes keep their existing rendering paths.
