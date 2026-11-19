# Arcane / Divine implementation status

2026-11-18. Work is local on `codex/arcane-divine-traditions`, based on
`dev` commit `66e473a77c74da54bd8701fd5a2614a0e7484985`. The original
`C:\repos\AshenSpire` checkout and its existing edits were preserved.

## Merged

None of this change has been merged.

## In queue to be merged

None. No remote branch or pull request has been created for this change.

## CD/CI testing

- [x] Local content/configuration generation, mechanic generation and derived-table checks.
- [x] Focused combat, save compatibility, reward, card presentation and content tests.
- [x] Damage shown versus dealt across 152 seeded fights, plus lethal-hit and Reflect cases.
- [x] Desktop and phone browser checks, including 16 allocation width/text-size combinations.
- [x] Final core suite: 151 passed, 0 failed.
- [x] Final generated runtime: 157 focused runtime/compatibility checks passed;
  final card data: 61 checks passed.
- [x] Final standalone build 0.7.4.201 and cold-boot desktop/phone inspection;
  no browser page errors or horizontal page overflow.
- [x] Final upgrade audit: every rolled Core card upgrade changes gameplay.
  Final runtime checks total 214 passing tests across 17 suites, including
  the 152-fight damage audit and Reflect/Divine/revive cases.
- [ ] Remote CI/CD: not run; this work has not been pushed.

The discovered fast suite exercised 1,209 files / 9,452 tests across the
implementation. Its initial failures were triaged and corrected; focused
reruns verify the affected files. This is not a claim that one final run of
all 9,452 tests passed on the final tree.

## PR ready

- [ ] PR not opened. Live `dev` advanced during implementation to
  `0327759be4e5ea47cabf5ddcd75ac19347a2528b` (card-art priority and automated
  documentation/build stamps). Those commits have not been integrated here.

## In progress

None. Requested local implementation and verification are complete.

## Not implemented

No requested gameplay or UI feature is intentionally deferred. Publishing,
merging and promotion have not been performed.

## Implemented changes

- [x] WIS governs Poise and Divine magic; INT governs Arcane magic.
- [x] CON adds 5 HP per point and no Poise in new profiles.
- [x] Starting stats, point allocation, gear, live combat modifiers, forecasts,
  receipts and card previews use the new casting and Poise rules.
- [x] Fire, Earth, Lightning, Frost and raw magic belong to both traditions and
  use the higher of INT/WIS, never their sum.
- [x] Force, Illusion and Alteration are Arcane; Divine and Decay/Necrotic are Divine.
- [x] Arcane-only and Divine-only cards display their names and distinct sigils;
  shared cards display Spell and both sigils, including in the Reading Desk.
- [x] Canonical spell classification, costs, triggers and mirrored-card identity remain usable.
- [x] Exclusive authored pools: Arcane 10 offense / 5 support; Divine 5 damage / 15 support.
- [x] Shared elemental support cards provide healing/cleansing, defensive buffs,
  suppression and resource utility. Reward-role weights preserve the requested
  ratios across eligible shared and exclusive cards while retaining within-role biases.
- [x] Higher effective INT/WIS selects future reward focus; ties use class tradition.
  Existing owned cards and already-earned offers remain playable and claimable.
- [x] New defaults are versioned. Genuine previous-dev save/profile fixtures
  retain their original casting and CON-Poise snapshots.
- [x] Allocation descriptions sit below the attribute name and stop before the
  stepper. Short labels omit bonus amounts and multi-point traits.
- [x] Expanded attribute disclosures omit the retired Ward pool and use the
  actual four-INT hand-growth cadence.
- [x] Updated SPEC.md, component catalog and the detailed rules contract.

## Local review

Source preview: <http://localhost:8398/index.html?shot=map&shotDeckAdd=core.mindLance,core.purifyingLight,core.cleansingEmbers,core.rootedShelter,core.stormBlessing,core.rimeVeil&shotDeckEditor=1>

Built preview: <http://localhost:8398/dist/AshenSpire.html?shot=customize>

Browser evidence is in
`C:\Users\const\AppData\Local\Temp\ashenspire-casting-qa`:

- `wisdom-allocation-mobile.png`: bounded descriptions, Wisdom at 2.
- `deck-editor-arcane-desktop.png`: Arcane label and rune.
- `deck-editor-divine-desktop.png`: Divine label and sun.
- `deck-editor-shared-desktop.png` and `deck-editor-shared-mobile.png`: both sigils.
- `standalone-shared-mobile.png`: final packaged game with both sigils.
- `allocation-matrix.json`: 320/390/606/1280 widths, Auto/S/L/XL text sizes.

Final gameplay contract: [Arcane and Divine rules](ARCANE-DIVINE-RULES.md).
