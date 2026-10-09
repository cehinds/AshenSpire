# Card layers and rank continuation

## Objective and ownership

Implement the approved card face, explicit layers 1–8 and the new layer 9 rank
label. Rank 0 is hidden; assigned ranks 1 and above read `Rank X` immediately
above the adaptive effect panel. Preserve the B + B footer symbols, title fade,
current painted components, full rules, live costs and inspection interactions.
Show native examples and merge through PR #1766 when its gates are satisfied.

Repository: `cehinds/AshenSpire`. Task branch: `feature/card-solid-bb`.
Working checkout: `D:/repos/.codex/worktrees/card-solid-bb/AshenSpire`.
Primary checkout and other sessions' changes are not owned by this task.

## Verified recoverable checkpoint

- Implementation commit: `9353b54845`.
- Editable wireframe and native evidence commit:
  `3d5bea6fe5b979e4873fa09ce53ff02d95df7c24`.
- That evidence commit was verified equal to `origin/feature/card-solid-bb`
  using `git ls-remote` before the subsequent dev reconciliation.
- PR: https://github.com/cehinds/AshenSpire/pull/1766 (open; not merged).
- Subsequent reconciliation incorporates dev
  `f785dc0eb1271ae03849f00c165d0645dca308f0`, including PR #1763's
  Molten River art pin and theme changes. Preserve those changes.
- Fetch the branch and inspect its current tip: later metadata/status commits
  may supersede this explicitly verified checkpoint.

## Implementation

`src/ui/components/illustratedCard.js` declares the layer contract and uses
complementary clips to separate existing painted fills and trims. Footer icon
and text have independent stacking positions. `illustratedCardFitter.js` moves
the rank and panel trim with the panel fill. The centered rank can share a row
with the narrow right icon column without intersecting it.

`src/model/playingCard.js` derives the visible label. Authored ability Rank 0
is hidden; positive ability ranks and explicit legacy ranks (including 1)
are written out. Legacy cards with no assigned rank have no label. Rendering
and accessibility are wired through `card.js`, `cardTagSymbols.js`,
`combatSigilView.js` and `styles/illustrated-cards.css`.

## Validation and reproduction

- `node --test tests/ability-card-identity.test.mjs tests/combat-sigils.test.mjs`:
  15 pass, including explicit legacy Rank 1 and all authored ability families.
- `node --test tests/extended-card-artwork.test.mjs tests/combat-card-presentation.test.mjs tests/card-rank.test.mjs tests/card-rank-up.test.mjs`:
  32 pass.
- `node tools/card-sigils-qa.mjs`, with
  `SIGIL_QA_OUT=docs/qa/card-rank-layers/corpus`: 2,198 variants pass desktop
  and phone, including widths 120/124/144/200, resize restoration, complete
  effects, rank/panel/icon geometry, accessible names, inspection and focus
  return without spending resources. `corpus/report.json` records capture
  provenance; these captures precede the Molten River dev reconciliation.
- `node tools/card-rank-layers-qa.mjs`: six native examples, rank zero and
  positive labels, paint z-order, panel/trim alignment, desktop/phone and
  inspection. Outputs `rank-examples.png` and `rank-phone.png` here.
- Browser tools accept `PLAYWRIGHT_MODULE` (installed Playwright module path)
  and `CHROME` (browser executable). On Windows place `TEMP` and `TMP` on D:.
- Builds must use `ASHEN_ART_SOURCE=cache`: dev now contains one tracked
  light-art override, so automatic tree detection otherwise mistakes that
  partial directory for a full art installation. Use the pinned art packs,
  never an old standalone HTML or a manually edited generated ordinal.
- `node tools/launch.mjs --build-only`; update PR #1766's authored receipt to
  the resulting box ordinal plus one; `node tools/about-changelog.mjs --write`;
  rebuild. Then run buildversion `--check`, about-changelog `--check-order`
  and receipts `--check --pr 1766`. Commit generated metadata, not built HTML.

## Reconciled build

The dev reconciliation builds as `0.7.1.1158` with source digest
`5627ec489a` and pinned `hd-assets-v15`. Six native examples passed again
after this art update. The final standalone build also passed desktop/phone hand geometry, complete effects, inspection and focus return; its report and screenshots are in `standalone/`. Final CI and independent review remain required.

## Remaining gates

1. Confirm the final origin head, current build receipt and current-head CI.
2. Obtain independent review. The prior automatic Codex reviewer reported its
   usage limit. No independent review of the new layer/rank diff exists yet.
   The session's developer instruction permits spawning agents only after an
   explicit user request or an applicable AGENTS/skill instruction. An async
   question asking the user to authorize a review agent or waive independent
   review is pending; no answer has arrived. Do not claim that self-review is
   independent review or silently bypass this requirement.
3. Fix verified findings, keep current with dev, regenerate metadata after
   source merges, then merge #1766 with a merge commit after all required gates.
4. Coordinate the batched test promotion with the integration chat when human
   authorization permits messaging it. Check architecture sync, test heavy CI
   and alternative synchronization separately. No release/main/tag action.
5. Owner visual acceptance of the new native rank placement remains distinct
   from automated geometry checks and source integration.

The original eight-layer editable wireframe is saved at
`docs/qa/card-layers/index.html`; the native nine-layer examples are
`docs/qa/card-rank-layers/preview.html`. These sources and curated PNGs survive
a fetch; temporary attachments, localhost tabs, process IDs and local logs
are not needed to continue.
