# Starting equipment selection

Open [the playable review page](../../../equipment-selection-preview.html) through the local server. It uses the production creation screen and disposable `shot` state. The class switcher covers Reaver, Starseer, Rogue and Herald; view controls constrain the frame to desktop, tablet or phone widths.

Final standalone build: **0.6.0.68**, source digest `4cc97d9128`. The branch includes dev `802065b3`; the latest integration changed only the automatic architecture document after the combat-effect update was incorporated.

## Changes

- Empty Hand is a normal selectable card in both hand sections. It represents the existing null hand state and does not change unarmed mechanics.
- The focused candidate drives the detail heading, preview/selected caption, and starting-card grid. Explicit Choose buttons update the actual starting loadout. Moving an item to the other hand leaves the previous hand empty.
- Cards retain their DOM nodes when chosen, allowing a 180 ms eased lift/enlargement and a smooth return for the previous card. Desktop/tablet use 6 px and 5%; phones use 4 px and 3%. OS and game reduced-motion preferences suppress movement.
- The compact two-column grid shows the selected hand's exact cards and copy counts, including grants and unarmed Dodge Roll. It uses the same composition, grant reconciliation and stamping as run creation. Quantity can change with the other hand. Previewing never mutates a run.
- Continue names the next equipment section; the last proceeds to Seed. The existing auto-advance option remains available and defaults off.
- Flavor fits one line and ellipsizes horizontally rather than clipping into the footer. Full wording remains available through the Flavor disclosure and the shared hover tooltip.

## Evidence

**573 browser checks passed with zero page errors.** [Machine-readable results](qa-results.json).

The browser sweep covers every displayed hand choice for all four classes at 1440×1000, 1024×1000 and 390×844: selected state, matching details, containment, empty hands, hand transfers, persistent nodes, lift/scale, explicit progression, keyboard Information, complete flavor text, and both reduced-motion modes. An additional 320×700 emulated-touch check confirmed both empty hands and a contained card grid.

**112 model cases** compare preview cards and quantities against independently created real runs for every available hand pair, and check that the preview leaves its input unchanged. This test is included in `tests/run-node.mjs`.

The full repository suite passed **138 tests**, plus **25 card/flick regression checks** and the 112 new preview cases. Build-version, shipped-alias identity, receipts, About/changelog and whitespace checks passed. Source and standalone About routes were checked. A rebuilt standalone also started a real disposable run with both hands empty and no page errors.

Final keyboard review found that the inspection focus loop skipped the native Flavor summary. Giving it an explicit focus entry fixed Tab traversal; Enter now opens the full wording. This final small change was checked in both source and the final standalone after the full browser/model/repository sweeps, with zero page errors. The repeatable browser runner now includes that regression assertion.

The four-card screenshots add a fourth representative card only to measure grid capacity. The unmodified unarmed loadout has three distinct card types; this fixture does not change game content or quantities. Desktop/mobile tests use Edge; touch is emulated, not a physical-device test. Existing 500 ms tooltip timing is reused unchanged.

## Screenshots

- [Desktop selected weapon](desktop-selected-weapon.png)
- [Tablet selected weapon](tablet-selected-weapon.png)
- [Phone selected weapon](phone-selected-weapon.png)
- [Desktop unarmed cards](desktop-unarmed-cards.png)
- [Phone unarmed cards](phone-unarmed-cards.png)
- [Four-card capacity on tablet](tablet-four-card-capacity.png)
- [Four-card capacity on phone](phone-four-card-capacity.png)
- [Reduced motion and long flavor](reduced-motion-and-flavor.png)
- [320 px phone](narrow-320-unarmed.png)
- [Keyboard-accessible full flavor](flavor-keyboard.png)
- [Unarmed run started in standalone](standalone-unarmed-run.png)

## Re-run

Start `node tools/serve.mjs --port 8318 --no-open --no-lan`, then run `node tools/starting-equipment-qa.mjs`. The runner uses an installed Playwright package; set `PLAYWRIGHT_MODULE` when it is outside the project and `QA_BROWSER` for a browser executable. `QA_URL` and `QA_OUTPUT` override the server and evidence directory.
