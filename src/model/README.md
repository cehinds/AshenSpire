# Game models

This directory contains the game's pure state, rules, calculations and projections.
The boundary rules are in the [architecture map](../../docs/ARCHITECTURE-MAP.md);
this page is a file-finding index for the large, intentionally flat module set.

Start with the feature's primary model, then follow its imports and focused tests:

| If you are changing… | Start here | Focused tests |
|---|---|---|
| Run and character progression | `state.js`, `progression.js`, `levels.js`, `levelup.js` | `tests/character-progression.test.mjs`, `tests/progression-*.test.mjs`, `tests/progression-modal.test.mjs` |
| Cards, decks and targeting | `deckRules.js`, `cardTargets.js`, `cardChoices.js`, `cardGroups.js` | `tests/deck-rules.test.mjs`, `tests/combat-card-targets.test.mjs`, `tests/card-target-preview-cost.test.mjs` |
| Combat rules and snapshots | `combatRules.js`, `combatSnapshot.js`, `combatStatusState.js` | `tests/combat*.test.mjs` |
| Equipment, smithing and loadouts | `equipmentUi.js`, `smithingCore.js`, `loadout.js`, `startingKits.js` | `tests/smithing-kit-basics.test.mjs`, `tests/equipmentCard.test.mjs`, `tests/starting-equipment-preview.test.mjs` |
| Settings and configuration | `advancedConfig.js`, `settingOverrides.js`, `settingsSync.js` | `tests/advanced-config.test.mjs`, `tests/setting-overrides.test.mjs`, `tests/settings-*.test.mjs` |
| Character creation | `characterCreation.js`, `classLibrary.js`, `startingAbilities.js` | `tests/character-sheet.test.mjs`, `tests/core-starting-decks.test.mjs`, `tests/starting-abilities.test.mjs` |

The tests named here are starting points, not exhaustive ownership lists. Search
the import graph when a behavior crosses model, engine, UI or authored content.
Keep browser and DOM work out of this directory; use the architecture map to
choose the correct owner when a change spans layers.
