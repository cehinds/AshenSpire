# Enemy levels and HUD input capture record

- Feature: Core 2 enemy levels 1–5, readable own/gear attributes, and correct enemy/player input ownership through transparent HUD padding.
- Captured: 2026-11-08 07:47 UTC (2026-11-07 22:47 America/Anchorage).
- Source commit: `7befd137c131341e559f8cba85bfe75dd06e1843`.
- Source stamp: `0.7.4.40`, digest `719a04534b`, from the committed `buildordinal.json`. These captures load the source server; that inherited stamp does not identify a newly compiled feature bundle.
- Capture command: `node tests/combat-hud-hitbox.browser.mjs`, using Chromium and pinned art packs. The test server is temporary and binds loopback.
- Scene: `index.html?shot=combat&gameProfile=core&shotSeed=4&shotEnemies=wanderingSoldier,wyrmAspirant,fellWarden&shotHand=5`. These are deterministic QA fixtures, not completed campaign playthroughs.
- Hosted preview target: [feature/OwnerEnemyLevelBudget](https://cehinds.github.io/AshenSpire/branches/feature/OwnerEnemyLevelBudget/latest/). It has not been verified as loading this source, so it is not yet a certified playable feature link.
- [Validation report](../../../qa/enemy-level-budget-browser.md) records results and limits. Later tooling integration `6486df0ee` passed 27 bundler/counter tests; these images retain the exact source provenance above.

Each image shows Wyrm Aspirant's level-2 inspector opened by a real long press through the formerly blocked enemy body point. All four images were visually inspected: the attributes label and own/gear values are readable, art is loaded, and the Close control is visible. The same test also inspected the player's painted HP track and targeted a Strike at the intended enemy in each viewport.

| File | Viewport | Input | SHA-256 |
| --- | --- | --- | --- |
| [desktop.png](desktop.png) | 1280×800 | Mouse | `2d7f607cf03ae125d1ef57a91184c05f7ef5bc650b2900aeccbeb085e01aa56b` |
| [mobile.png](mobile.png) | 390×844 | Touch | `9724d7d557521586879c4cc4538fbe4b977bfe2d747833cfceecf2930688099a` |
| [wide.png](wide.png) | 1920×1080 | Mouse | `3b1a4b28ee02e0d178e20f45f65b5549eae3d403f6dbdd6f0e7f61f4cf145dca` |
| [tablet.png](tablet.png) | 768×1024 | Touch | `3db527900fea7657a50ea06ce32351a75a841792e252235ef69c2ecb26a1e333` |

The older `desktop-before.png`, `phone-before.png`, `desktop-after.png`, and `phone-after.png` document the earlier inspector-label comparison; they are separate from these final crowded-input captures.
