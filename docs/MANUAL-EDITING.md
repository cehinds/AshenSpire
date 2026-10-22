# Editing AshenSpire without an agent

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
| A base card's costs, effects, text or icon | `content/source/cards/*.json`; Rogue and co-op additions currently remain in `src/content/cards/rogue.js` / `coop.js` | Compile authored content; Fast core tests |
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
