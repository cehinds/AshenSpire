# Starting equipment review

Build **0.6.0.73**, source digest **e68d90147b**. PR #885 was rebased onto dev `2eafa5a6`, including the active combat ability inspection and authored combat-tag source changes.

[Play the equipment review](../../../equipment-selection-preview.html) through the local server. It uses the production creation screen and disposable shot state, with class selection, desktop/tablet/phone views and reset.

## Current behavior

- Empty Hand is a selectable card in each hand and uses the existing unequipped state.
- Larger equipment cards stay in two columns on the left. Details and a compact two-column starting-combat-card grid sit on the right, with Continue at bottom-right. Phones stack these areas.
- Only the focused candidate exposes Choose/Selected and Information. Browsing previews a candidate; Choose updates the loadout. Moving a weapon empties its previous hand.
- Persistent card nodes lift/enlarge over 180 ms: 6 px / 5% on larger screens and 4 px / 3% on phones. OS and game reduced-motion preferences suppress movement.
- Choice gaps are 32/12 px, half their original values. Hidden action space stays reserved so browsing does not move rows under the pointer.
- Starting-card quantities use actual loadout composition, grant reconciliation and stamping. Previewing never mutates the run.
- Titles grow vertically to avoid clipping. Flavor fits one row with an ellipsis, with complete wording available through shared tooltips and keyboard/touch inspection.

## Validation after rebase

- **870 browser assertions passed on the rebuilt standalone, with zero page errors.** All four classes and every displayed hand choice at 1440x1000, 1024x1000 and 390x844. Covers selection, quantities, containment, empty hands, transfers, retained nodes, animation, focused actions, title fit, two-column placement, Continue, keyboard flavor access and reduced motion. [Machine-readable results](qa-results.json).
- **138 full Node tests passed**, plus **25 card/flick regression checks** and **112 hand/loadout comparisons** against independently created actual runs. Preview input remains unchanged.
- Rebuilt every shipped alias and passed build-version, shipped identity, receipts, About/changelog and whitespace checks.
- Browser QA used an independently served copy of the final standalone while the Node suite ran, so temporary regression fixtures could not affect it.

The four-card capacity screenshots add a representative fourth card only to measure layout. The unmodified unarmed loadout has three distinct card types; the fixture does not change content or quantities. Phone input is emulated in Edge, not tested on physical devices. Existing 500 ms tooltip timing is reused unchanged.

## Screenshots

[Open the gallery](index.html).

- [Complete reference layout](reference-layout-tablet.png)
- [Desktop selected equipment](desktop-selected-weapon.png)
- [Tablet selected equipment](tablet-selected-weapon.png)
- [Phone selected equipment](phone-selected-weapon.png)
- [Unarmed starting cards](desktop-unarmed-cards.png)
- [Unarmed starting cards on phone](phone-unarmed-cards.png)
- [Four-card capacity on tablet](tablet-four-card-capacity.png)
- [Four-card capacity on phone](phone-four-card-capacity.png)
- [Continue](continue-button.png)
- [Hand transfer](weapon-hand-transfer.png)
- [Full flavor through keyboard inspection](flavor-keyboard.png)

The gallery also retains earlier layout comparisons from the visual review.

## Preview download and rerun

Extract the Actions dev-preview archive. Open `AshenSpire.html` directly for the standalone game, or run `node serve-preview.mjs` in the extracted folder and visit http://127.0.0.1:8318/equipment-selection-preview.html. Set PORT to another number if needed. The archive includes the screenshot gallery.

In the repository, start `node tools/serve.mjs --port 8318 --no-open --no-lan` and run `node tools/starting-equipment-qa.mjs`. Set PLAYWRIGHT_MODULE when Playwright is outside the project, QA_BROWSER for the browser executable, and QA_URL / QA_OUTPUT to override the server and evidence directory.