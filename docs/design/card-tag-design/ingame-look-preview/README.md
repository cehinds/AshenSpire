# In-game card visual proposal

Source: AshenSpire `f7a24e0e39dd7823c15f89afd6023782526655d0`, captured 2026-10-15 UTC.

Open http://127.0.0.1:8767 while `node server.mjs` runs. This proxy uses the repository's `tools/serve.mjs` on 8766 to resolve real fetched art. Set `ASHENSPIRE_REPO=/absolute/path/to/AshenSpire` if the checkout is elsewhere (default: the sibling AshenSpire workspace). For this preserved docs/design location, set ASHENSPIRE_REPO explicitly when launching, for example `ASHENSPIRE_REPO=/absolute/path/to/AshenSpire node server.mjs`. The default path is intended for the original output workspace. No game files were modified.

The gallery imports `illustratedCardHtml`, `illustratedArtwork` and `fitIllustratedCards` directly from the current game and loads `styles/base.css`, `styles/kit.css` and `styles/illustrated-cards.css`. All original `data-card-layer` / `data-component` nodes remain. This is a standalone visual proposal, not a playable engine implementation.

All six proposed costs, rank, school and stance are unspecified. A numeric MP value selects the existing dual-resource layout, then its displayed binding becomes `?` before capture. No approved numeric cost or stance is inferred. The footer explicitly reads Unassigned. The compact effects are exact proposal face strings; the full proposed rules appear after tapping a card. In particular, Grease inspection describes unavoidable fire, 3× fire damage, Burn 3, 1.5× splash and the unresolved splash basis.

| Proposed card | Existing artwork reused |
| --- | --- |
| Ward Armor | `assets/cards/extended/card-crystalBarrier-1024.webp` |
| Grease | `assets/cards/extended/card-slimed-1024.webp` |
| Smite | `assets/cards/extended/card-sacredHarvest-1024.webp` |
| Poison | `assets/cards/extended/card-envenomCard-1024.webp` |
| Mirrors | `assets/cards/extended/card-afterimageCard-1024.webp` |
| Foresight | `assets/cards/extended/card-astralInsight-1024.webp` |

The artwork is existing game art selected for visual similarity only. It does not assign a school, stance or mechanic and is not a newly commissioned/approved illustration. Other expanded proposals reuse `scholarsInsight`, explicitly annotated below each card; the six featured mappings are the reviewed focus.

Captures: `hero.png` (three-column, two-row card contact sheet); `overview.png`; desktop 1440×900, wide 2560×1440, tablet 1024×768 and mobile 390×844 (viewport captures); `grease-inspection.png` 1200×900. The hero is generated at viewport 1100×1150 and cropped to the actual `.hero` section, preserving both rows. `capture.mjs` launches Chromium exclusively through `tools/browser.mjs` and closes the browser/profile in a finally block.

`audit.json` records decoded image references, actual rule line counts and layer counts. Initial verification: 54 images decoded successfully, zero page errors, every featured face at one or two physical lines without overflow. Screenshots are fresh renders, not edited composites.
