# Starting equipment selection

Open [the playable review page](../../../equipment-selection-preview.html) through the local server. It uses the production creation screen and disposable `shot` state. The class switcher covers Reaver, Starseer, Rogue and Herald; view controls constrain the frame to desktop, tablet or phone widths.

Final standalone build: **0.6.0.72**, source digest `adad7547c1`. The branch includes dev `4e1882a5`, including the latest combat-tag source changes.

## Reference layout

[Complete tablet section](reference-layout-tablet.png) · [Desktop section](reference-layout-1440.png) · [Phone details](reference-layout-phone.png). The latest layout follows the owner reference: larger cards in two left-hand columns, details and starting cards on the right, Continue at bottom-right. Empty Hand and focused-only actions remain available. Only layout CSS changed in this follow-up; the complete Node/model suite below passed at the preceding dev integration, and the 870-case browser sweep plus build checks were rerun for this layout.

## Interaction and spacing

Only the focused equipment candidate exposes Choose/Selected and Information. Action space stays reserved to avoid moving rows while browsing. Choice gaps are 32/12 px (previously 64/24); starting-card gaps are also halved. Larger choices stay in two columns beside the details and starting-card preview. Continue aligns with the bottom-right of the choice list; phones stack these areas. Title strips now grow vertically with their font, fixing the cut-off Empty Hand and weapon names.

Keyboard selection and complete Empty Hand text were checked at 320, 390, 1024 and 1440 px. The 870-check browser sweep covers all hand choices, focused action visibility and title containment. The rebuilt 0.6.0.72 standalone passed focused selection, two-column layout, Continue alignment and phone stacking checks. After integrating current dev, the full Node suite and all 112 hand/loadout comparisons passed again, followed by version, shipped-alias, receipt and About checks. Final standalone smoke checks passed for all four classes at desktop, tablet and phone widths (12 cases, zero page errors).

## Changes

- Empty Hand is a normal selectable card in both hand sections. It represents the existing null hand state and does not change unarmed mechanics.
- The focused candidate drives the detail heading, preview/selected caption, and starting-card grid. Explicit Choose buttons update the actual starting loadout. Moving an item to the other hand leaves the previous hand empty.
- Cards retain their DOM nodes when chosen, allowing a 180 ms eased lift/enlargement and a smooth return for the previous card. Desktop/tablet use 6 px and 5%; phones use 4 px and 3%. OS and game reduced-motion preferences suppress movement.
- The compact two-column grid shows the selected hand's exact cards and copy counts, including grants and unarmed Dodge Roll. It uses the same composition, grant reconciliation and stamping as run creation. Quantity can change with the other hand. Previewing never mutates a run.
- Continue names the next equipment section; the last proceeds to Seed. The existing auto-advance option remains available and defaults off.
- Flavor fits one line and ellipsizes horizontally rather than clipping into the footer. Full wording remains available through the Flavor disclosure and the shared hover tooltip.

## Evidence

**870 browser checks passed with zero page errors.** [Machine-readable results](qa-results.json).

The browser sweep covers every displayed hand choice for all four classes at 1440×1000, 1024×1000 and 390×844: selected state, matching details, containment, empty hands, hand transfers, persistent nodes, lift/scale, explicit progression, keyboard Information, complete flavor text, and both reduced-motion modes. An additional 320×700 emulated-touch check confirmed both empty hands and a contained card grid.

**112 model cases** compare preview cards and quantities against independently created real runs for every available hand pair, and check that the preview leaves its input unchanged. This test is included in `tests/run-node.mjs`.

The full repository suite passed **138 tests**, plus **25 card/flick regression checks** and the 112 new preview cases. Build-version, shipped-alias identity, receipts, About/changelog and whitespace checks passed. Source and standalone About routes were checked. A rebuilt standalone also started a real disposable run with both hands empty and no page errors.

Final keyboard review found that the inspection focus loop skipped the native Flavor summary. Giving it an explicit focus entry fixed Tab traversal; Enter now opens the full wording. This change was checked in both source and standalone, then the complete browser sweep was rerun with the Tab regression assertion: 870 checks passed. The final archive layout was also served independently: Empty Hand, Continue, class switching and phone width worked with zero page errors.

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

## Downloaded preview

Extract the GitHub Actions dev-preview archive. Open AshenSpire.html directly for the full standalone game, or run `node serve-preview.mjs` in the extracted folder and open http://127.0.0.1:8318/equipment-selection-preview.html for class and viewport controls. If that port is already occupied, set the PORT environment variable to another port. Screenshots are in docs/preview/starting-equipment/index.html.

Additional evidence: [selection before](selection-before.png), [selection after](selection-after.png), [Continue button](continue-button.png), [Continue opens Off Hand](continue-off-hand.png), [weapon hand transfer](weapon-hand-transfer.png), and [packaged review controls](packaged-preview-controls.png).
