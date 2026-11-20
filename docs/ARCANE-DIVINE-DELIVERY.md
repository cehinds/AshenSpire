# Arcane / Divine implementation verification

Initial implementation was verified on 2026-11-18 against dev commit
`66e473a77c74da54bd8701fd5a2614a0e7484985`. Integration on 2026-11-19
combines it with dev `0b11a35843`, including the intervening Gear, Smash,
saved-preview and stat-allocation changes. The original checkout and its
existing edits were preserved. The feature PR records current CI and merge status.

## Merged

None of this change has been merged.

## In queue to be merged

Merge requested by the owner on 2026-11-19; the PR records the current queue state.

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
- [x] Merged-tree verification (2026-11-20, PR #2892): core lane 151/0; every
  non-slow discovered file passes except `preview-restamp-recovery`, which fails
  identically on `origin/dev` locally (environmental). Remote CI runs on the PR.

The discovered fast suite exercised 1,209 files / 9,452 tests across the
implementation. Its initial failures were triaged and corrected; focused
reruns verify the affected files. This is not a claim that one final run of
all 9,452 tests passed on the final tree.

## PR ready

- [x] Reconciled current dev's stat-row evaluation, equipment and saved contexts.
- [x] Added separate reward-policy versioning for profiles that already had casting traditions.
- [x] Browser sandbox acceptance: `docs/qa/acceptance-spell-traditions.json`,
  184 PASS / 0 FAIL against `origin/dev` at 1280x800, 390x844, 1920x1080 and
  1024x768 (PR #2892 body, *Acceptance criteria*).

## In progress

Integration validation, PR review and merge delivery.

## Not implemented

No requested gameplay or UI feature is intentionally deferred.

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

## Review evidence

Screenshots (before/after, desktop and phone) for every QA scene are published at
<https://claude.ai/artifact/52NuqcXvNS6kg3b4d9foHe> and linked from the PR #2892
body. The earlier localhost previews and the local `%TEMP%` evidence folder were
not published and are superseded by that page and the PR's CI artifacts.

Final gameplay contract: [Arcane and Divine rules](ARCANE-DIVINE-RULES.md).
