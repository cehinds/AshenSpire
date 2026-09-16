# Smithing item-upgrade redesign — design QA

## Source and implementation evidence

- Reference: `C:\Users\const\AppData\Local\Temp\codex-clipboard-b8c60894-83b4-41c5-a1f6-21ebbd97c23c.png` (94x45)
- Reference: `C:\Users\const\AppData\Local\Temp\codex-clipboard-8f0db6be-bf97-4619-9d38-9fa6db2edf8c.png` (108x61)
- Reference: `C:\Users\const\AppData\Local\Temp\codex-clipboard-860f0793-7f50-4eea-8a85-de4754e36d9e.png` (344x225)
- Reference: `C:\Users\const\AppData\Local\Temp\codex-clipboard-736c30f1-0ca9-4bdb-8cfc-9482a9701ffa.png` (339x262)
- Controlling reference: `C:\Users\const\AppData\Local\Temp\codex-clipboard-39f0eb9f-3254-416b-95f1-d35845e50777.png` (537x327)
- Implementation, selected-detail crop: `docs/preview/armament-smithing-selected-detail-1200x730.png` (512x450), SHA256 `D441F838F6FACDCB24CFB85351CF69000DA98D0425AF35CC4E2C29449FC14071`
- Implementation, desktop: `docs/preview/armament-smithing-one-1200x730.png` (1200x730), SHA256 `0DEB3AE63DED1D77EE923C0DC6E76EC3CB53F3706F783ED570863359876FE37C`
- Implementation, top state: `docs/preview/armament-smithing-one-390x844.png` (390x844)
- Implementation, scrolled detail state: `docs/preview/armament-smithing-one-deltas-390x844.png` (390x844), SHA256 `D8A0C34943271313F384804D5DC6AB997A05DAB9AFBCB6DE8B06F9F00B3E155C`
- Combined comparison input: `docs/preview/smithing-design-qa-comparison.png` (1400x1160), SHA256 `5793E6439D7502EAD501EB9B235497D67B5D4B7FDFBB1311634F8F23ECF7D53B`
- Browser viewport proof: 390x844 at density 1 in `tools/armament-smithing-ui.mjs`; the current in-app preview was also inspected live.

## Fidelity surfaces

- The Selected item and Stone-cost cells are borderless and retain the AshenSpire dark brown/gold visual language.
- The selected item name is white and uses the same 1rem display typography as Requirements and upgrade-row titles.
- `REQ / AVAIL` is above the numbers; Smithing Stone Cost, the rock icon, and the required/available pair stay on one line.
- Required cost remains white and available balance is green when affordable.
- Equipment Stats and Requirements are flat, borderless rows attached directly to the selected-item section.
- Slashing Strike, Weapon Guard, and Weapon Technique remain distinct bordered, expandable card modals; opening a row renders its actual card preview and complete change/scaling facts.
- The inactive Weapon Guard row remains present, explicitly says `not in active deck`, and is visually muted instead of being removed.
- Straight Sword, Round Shield, and Wayfarer Plate use existing item art and sit in one data-driven candidate grid; armor is not relabelled as a weapon.
- The sticky action row remains reachable while the candidate list and selected details scroll inside the full-pane modal.

## Interaction and responsive checks

- Click opens the shared confirmation/cost modal; completed hold commits only after the affordability gate passes.
- 1200x730 and 390x844 source-driven UI checks pass with zero document-level horizontal overflow.
- Mobile top and scrolled-detail captures together cover the candidate grid, selected item/cost summary, Requirements, affected rows, and action bar.
- Live inspection confirmed `0` horizontal overflow, a `0px` selected-summary-to-stats gap, `0px` side borders/radius on the two flat rows, and `7px` radius plus a real rendered card in each expandable gameplay modal.
- Automated geometry confirms the `REQ / AVAIL` header slash and `1 / 1` value slash share the exact same horizontal anchor at desktop and mobile widths.

## Findings and iteration history

- Fixed: Smithing Stone Cost previously wrapped to three lines.
- Fixed: selected equipment name was smaller and gold instead of matching the white fold-title hierarchy.
- Fixed: Equipment Stats and Requirements used nested cards instead of flat selected-item rows.
- Preserved by correction: Strike, Guard, and Technique are still expandable card modals, not flattened data rows.
- Fixed: the picker was armament-only; it now accepts namespaced armament, armor, and explicitly authored relic candidates.
- P0: none.
- P1: none.
- P2: none.
- P3: none in the compared state.

final result: passed
