# Reading Desk implementation QA

final result: passed

This covers the local implementation and the packaged game. It is an adaptation
of the selected illustration using actual game cards and rules, not a claim of
pixel-identical decoration. Remote CI, merge and deployment were not performed.

## Reference and evidence

- Source: `docs/design/deck-editor/reading-desk.png` (1488 x 1058), plus
  `mobile-browse.png`, `mobile-inspect.png` and `mobile-folded-list.png`.
- Updated captures: `implemented-desktop.png` at 1488 x 1058, and
  `implemented-mobile-{browse,inspect,deck}.png` at 390 x 844 in that directory.
- `implemented-ingame.png` captures the final packaged game reached through
  the map Deck button, with Shield Defend selected and verified art loaded.
- Additional viewport checks: 1280 x 720 and 360 x 640. No horizontal overflow;
  at 360 x 640, Done ends at y=617 and the inspector action ends at y=549.
- Source preview: `http://127.0.0.1:4340/deck-reading-desk-preview.html`.
- Packaged game: `http://127.0.0.1:4340/build/deck-reading-desk-v6-high/AshenSpire.html?shot=map`.
  This uses the game's ephemeral screenshot run, leaving player saves untouched.

## Comparison and corrections

A separate agent compared all desktop/mobile references, reviewed the implementation
and reviewed the functional follow-up. Source and implementation were also opened
side by side for direct inspection.

| Gap | Implementation |
| --- | --- |
| Missing library scope | All / In Deck alongside collection search |
| Weak row hierarchy | Wider paintings, colored type labels, secondary ownership |
| Repeated card rules | One full native rules area, flavor inside the face, glossary below |
| Card cost/title mismatch | Blue overlapping cost medallion and centered title; stamina/mana retained |
| Hidden dragging | Visible grips and dashed deck drop target; existing pointer handling retained |
| Missing deck views | Own search, List / Cards and collapsible type sections |
| Missing feedback/reversal | Action status and session Undo, including allocation and mint state |
| Missing phone return | Inspector Back preserves the opening pane, including after last-copy removal |
| Hidden keyboard focus | Inspect tab transfers focus to Back; pane switches skip folded rows |
| Local-only art URLs | Canonical asset IDs from verified published hd-assets-v6 |

The reference's fictional 10/30 deck, sample card counts and 7 Block do not change
real mechanics. This Reaver run owns 11 cards and Shield Defend grants 3 Block.
Equipment-owned copies remain separate and locked. Exact filigree and the painted
candle/books ornament are not reproduced; the existing city backdrop is used.

## Verification

- All 85 focused renderer/model/rules/card/glossary tests pass,
  including add/remove, pointer drag, ordered movement and controller
  bindings. Dedicated tests cover multi-step Undo and navigation regressions.
- Official art-manifest tests: 14 passed. All 70 recovered card painting/outline
  files match the published v6 IDs and hashes. All three packs are verified.
- Full high-default game bundle passed; both art tiers and common media included.
- External pack verification: 198 checks passed.
- Browser: map Deck door opens Reading Desk; Add -> Done -> reopen preserves 12
  cards. Images resolve to content-addressed pack objects and all inspected images
  loaded; no errors or warnings on that bundled-game check.
- Browser: Undo returns 12 to 11, deck search filters to Gorefire, List / Cards
  switches presentation, type groups fold, inspector Back restores the prior pane,
  and all primary phone actions remain reachable. Earlier pointer-drag and Cancel
  rollback checks remain covered by regression tests.
- Content generation and whitespace checks pass.

## Remaining acceptance

Physical touch/controller use and owner visual acceptance remain open. No remote
CI, PR, merge, promotion or deployment is claimed. The built HTML is ignored and
is available locally for review.
