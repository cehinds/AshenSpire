# Editing AshenSpire without an agent

Open the repository folder in Visual Studio (**File → Open → Folder**).
No solution conversion is needed. Install Node 22.14 or newer. Right-click
`package.json` for the **AshenSpire** tasks defined in `tasks.vs.json`.
Use **Serve without opening a browser** for the source game, then open the
printed local URL. **Build standalone** creates the portable game and stamps a
build; run it when ready to package your changes.

## Find the owner first

| Change | Edit here | Verify |
| --- | --- | --- |
| A base card's costs, effects, text or icon | `content/source/cards/*.json`; Rogue and co-op additions currently remain in `src/content/cards/rogue.js` / `coop.js` | Compile authored content; Fast core tests |
| Core generated ability grades and riders | `src/content/progression/cardFamilies.js`, `cards.js`, `lessons.js`, `cardRecipeText.js` | `node --test tests/progression-card-content.test.mjs` |
| Enemy definitions | `content/source/act1Enemies.json`, `act2Enemies.json`, `act3Enemies.json`; Core expansion owners in `src/content/enemyExpansion.js` | Compile authored content; Fast core tests |
| Weapons, starting kits, mounted cards | `content/source/weapons.csv`, `startingKits.csv`, `weaponCardPackages.json`; Core gear in `src/content/progression/gear.js` | Compile authored content; Fast core tests |
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
