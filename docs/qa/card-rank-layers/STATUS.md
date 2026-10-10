# Card layers and rank continuation

## October 9 — owner approved merging the master editor

The owner approved the current master-component/game preview and requested
merge. This supersedes the earlier visual rejection and merge hold below.
The complete source, editor and curated native screenshots are committed;
newer changes on the remote PR branch have been merged without conflicts.
Independent reviewer `review_card_master` approved the authored PR diff at
`cddfeb2076`, with no blocking findings and 20 focused tests passing. The owner
explicitly authorized that reviewer. Current-head build and CI gates still apply.
See `../card-layers/master/README.md` for the saved visual evidence.

## October 9 — master component appearance and real combat preview

The master now exposes `components` (image paths, fit, styles, typography and
rank bevel decorations) and `symbols.actions` / `symbols.tags` (individual
identity images or inert SVG shapes). Card content remains bound to the model.
The explorer's Component appearance panel edits those fields and previews them
before saving. Saving and exporting clear the saved appearance draft so a later
direct edit to the master is not masked by an already-applied browser copy.

The editor includes the actual combat screen and a refresh control. The local
`--editor-write` server regenerates card data on a source-game refresh after a
direct JSON edit, and serves local authoring images ahead of the pinned cache.
Published builds still use the repository's normal build and art-pack workflow.

Verified in an isolated workspace: editor PNG change saved to master; direct
title-color and footer-image changes appeared in actual combat cards after
refresh; live names/effects remained intact; PNG decoded successfully. Restored
approved visuals were captured in combat, inspection and phone screenshots with
zero page errors (`master-game/`). The group/save/export regression passed
(`master-components/`), and 13 focused tests passed. This remains local source
work, not a merge or published build.
The final master-appearance corpus passed for 2,198 native faces on each of
desktop and phone, including widths 120/124/144/200 and restoration, with zero
page errors (`master-corpus/report.json`).

## October 9 — shared game JSON and anchored text box

The owner approved applying the preview layout to the game and requested the
same JSON structure. `src/content/card-layout.json` now contains the preview's
`version`, `order`, `layouts`, `coordinateSpace`, shared references and group
definition, alongside the existing artwork and component metadata. The uploaded
blue rank geometry is the shared default. Native cards consume the generated
data; the usual build regenerates it from this JSON.

Selecting the text box or its rank selects the panel, trim, rules, blue bar and
rank text together. Moving and scaling preserve their relative placement. Long
effects expand the panel upward while the rank stays attached to the upper
edge. Rank 0 remains hidden.

The local server's `--editor-write` bridge lets **Save to game** update the
canonical source and regenerate card definitions. **Export JSON** also saves
to the game and downloads the identical document. Browser drafts remain drafts
until one of those actions succeeds. New or refreshed source game views use the
saved layout; existing standalone builds require rebuilding.

Verified: 11 focused tests; isolated editor move/scale/save/regenerate/reload;
exact exported-versus-saved JSON equality; fresh native cards; hidden Rank 0;
expanded-panel anchors; desktop and phone; stale-write and foreign-origin
rejection. Native six-card gallery checks also passed on desktop and phone,
including inspection, paint order, rank/rules clearance and unclipped effects.
Evidence is in the task visualization folder's `card-save/` and `anchored-rank/`.
The full source corpus also passed on desktop and phone: 2,198 native faces per
device, widths 120/124/144/200 and restoration, complete effects, attached trims,
rank clearance, title coverage, inspection and zero page errors. See
`anchored-corpus/report.json` in the same evidence folder. Layout measurement
and transform writes are batched to avoid a forced layout per card.
This is a local source implementation; PR #1766 remains unmerged.

## October 9 — interactive editor added locally

The owner requested selection, dragging, scaling, component-edge/center snapping,
grid lines and freely draggable layer order in the existing explorer. These are
implemented in `docs/qa/card-layers/editor.js`, `layout-math.js`, `explorer.js`
and `explorer.css`. The editor flattens isolated native components into independent
preview planes, so changing a layer's position changes its actual paint order.
It also supports group selection, eight resize handles, keyboard nudging,
pointer cancellation, undo/redo, browser persistence and JSON export.

`tools/card-layer-editor-qa.mjs` passed in Edge on desktop and a narrow viewport,
including real touch pointer events. Screenshots and exported layout are under
the task visualization folder's `card-editor/`. See the explorer README for
controls and the reproducible command. This is local preview tooling; the
prior game changes remain unmerged.

## Latest owner correction — local preview, merge held

The owner rejected the prior result, then explicitly selected the existing
**Card layer explorer** to break the actual cards into parts. The explorer at
`docs/qa/card-layers/index.html` now renders native components with nine layer
toggles, individual visibility/Solo controls, isolated component tiles and a
Rank 0–5 selector. Its former SVG study is preserved as `wireframe.html`.

Rank is now a compact blue, faceted bar inspired by the mana gem. The bar and
`Rank X` text are independently inspectable parts on layer 9. Rank 0 is hidden.
The source preview and rank gallery are updated locally; no new merge or
publication is authorized by the rejected visual result. Do not mistake the
earlier validation below for owner acceptance of the replacement.

Verified locally: 15 focused tests; native rank gallery on desktop and phone,
including inspection; all six explorer cards, nine layers, part Solo, unchanged
footer geometry under isolation, rank switching and narrow viewport bounds.
Explorer browser run had zero page errors or failed HTTP responses. Evidence is
under the task's D: visualization folder in `blue-rank/`.

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

CI on `5231fe396e1ca92cd51ae144cfa4e294b085410c` passed preview, core, receipts and browser smoke checks. Discovered shard 0 caught one old equipment-card assertion that required the footer name to have no layer attribute. The assertion now verifies the new layer-8 name markup; the targeted equipment-card suite passes. Fresh CI on the following test-only commit remains required.

## Remaining gates

1. Confirm the final origin head, current build receipt and current-head CI.
2. Independent review is complete: `review_card_master` approved the authored
   implementation at `cddfeb2076` with no blocking findings. The automatic PR
   review bot remains quota-limited; the owner authorized the local reviewer.
3. Fix verified findings, keep current with dev, regenerate metadata after
   source merges, then merge #1766 with a merge commit after all required gates.
4. Coordinate the batched test promotion with the integration chat when human
   authorization permits messaging it. Check architecture sync, test heavy CI
   and alternative synchronization separately. No release/main/tag action.
5. The owner approved the current native master-component preview and merge.

The original eight-layer editable wireframe is saved at
`docs/qa/card-layers/index.html`; the native nine-layer examples are
`docs/qa/card-rank-layers/preview.html`. These sources and curated PNGs survive
a fetch; temporary attachments, localhost tabs, process IDs and local logs
are not needed to continue.
