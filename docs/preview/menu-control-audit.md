# Armoury and menu control audit

PR #779 replaces resizable Armoury trays with natural-height sections in one scrolling modal. Character, Equipment, Inventory and Cards retain the game's existing gold, parchment, dark-panel and sprite treatment. Gear selection does not require dragging, and resizing does not close disclosures.

## Confirmed fixes

- In-run Load previously accepted an empty slot and silently returned. Empty rows now explain that no climb is saved there and cannot become the Continue target. Title empty slots still support creating a new game.
- Escape from a Smith upgrade confirmation previously closed both the confirmation and the Smith beneath it. Only the topmost dialog now handles dismissal. Smith also supports backdrop dismissal.
- Armoury used independently constrained pane/tray heights, clipping folded summaries and requiring multiple scroll regions. It now uses one page scroll, natural-height sections, readable summaries, visible Change actions and an explicit Show all items filter reset. Nested Escape does not close the Armoury underneath another dialog.

## Browser coverage

Chrome desktop (1440px), phone (390px), with additional Armoury checks at 320px:

- Armoury: all four tabs; compatible-item filter and clear; list/grid toggle; one-open character accordion; complete deck gallery with 5:7 card faces; content width and scrolling; Escape.
- Title: empty Load slot, new-game review, Back, X and keyboard selection.
- Complete phone save flow: create slot 3, enter map, Save and Quit, reveal folded title, Load and verify only slot 3 contains the new save.
- In-run Load: unavailable empty slots and disabled Continue when no save exists.
- Smith: X, Back, Escape, backdrop, and nested confirmation cancellation.
- Quick menu: dismissal. Combat Draw, Discard and Potions: close controls.
- Settings: all six tabs and Done. History, Lobby, Custom Run, Collection: Back. Profile: X.
- Trader: all seven category disclosures and Leave, with no browser errors.

The originally reported Smith X failure did not reproduce on current dev. The confirmed nested cancellation fault was repaired. The older save-flow instrument required an update to reveal the intentionally folded title; Save and Quit itself was working.

## Checks and limits

Slot-selection regression: 7 checks. Modal-shell contracts: 58. UI component contracts: 21, with 24 planted-failure self-tests. Title save-flow browser instrument: 13 checks.

This is a broad menu audit, not a claim that every possible game state was exercised. Live multiplayer/network operations, operating-system file dialogs/downloads, destructive profile/save operations, and every purchase/upgrade affordability permutation were not tested. Gameplay rules for locked equipment and unaffordable upgrades remain unchanged.

Full Node suite before the final dev rebase: 136 passed, 0 failed. Final Armoury focus and layout checks passed at 1440, 390 and 320 pixels. Generated build 120 passed buildversion and verify-shipped checks.

After rebasing onto dev 8c3c88e6, browser interactions passed again at 1440, 390 and 320px. The dedicated arrival check passed 42/42, including absence of Inventory from Character. Inventory regression passed 32/32 with desktop/phone captures. The focused presentation matrix passed all four source/dist Armoury cells at 320x640 and 390x844, plus 19/19 detector mutants, with exact semantic parity. These replace the retired tray-attribute consumers raised in review.

Supplementary limitations: the full historical presentation matrix still expects older Grace capacity/title/mana and Creation slot fixtures; those unrelated cells remain red. The historical actionregistry-destinations migration check reports 11/14, with obsolete six-file scope, exact Quick Menu source text and equipment-only card grouping expectations. Runtime destinations and the current adapter pass. Chromium reported a Windows-locked temporary profile during one cleanup after successful assertions.
