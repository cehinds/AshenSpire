# In-game card visual proposal

Source: AshenSpire `f7a24e0e39dd7823c15f89afd6023782526655d0`, captured 2026-10-15 UTC.

Open http://127.0.0.1:8767 while `node server.mjs` runs. This proxy uses the repository's `tools/serve.mjs` on 8766 to resolve real fetched art. Set `ASHENSPIRE_REPO=/absolute/path/to/AshenSpire` if the checkout is elsewhere (default: the sibling AshenSpire workspace). No game files were modified.

The gallery imports `illustratedCardHtml`, `illustratedArtwork` and `fitIllustratedCards` directly from the current game and loads `styles/base.css`, `styles/kit.css` and `styles/illustrated-cards.css`. All original `data-card-layer` / `data-component` nodes remain. This is a standalone visual proposal, not a playable engine implementation.

All six proposed costs, rank, school and stance are unspecified. A numeric MP value selects the existing dual-resource layout, then its displayed binding becomes `?` before capture. No approved numeric cost or stance is inferred. The footer explicitly reads Unassigned. The compact effects are exact proposal face strings; the full proposed rules appear after tapping a card. In particular, Grease inspection describes unavoidable fire, 3× fire damage, Burn 3, 1.5× splash and the unresolved splash basis.

The preview now selects `CARD_ART_SIMPLE` and passes each canonical reference definition plus current registries through `illustratedArtwork`. Every featured and expanded card must resolve `kind: simple`; unsupported simple references fail rather than silently falling back to painted art. `artworkComposition` supplies the current element/status motif layers.

| Proposed card | Canonical visual reference | Current Simple library asset |
| --- | --- | --- |
| Ward Armor | `crystalBarrier` | `assets/cards/library/magical-defend-05-1024.webp` |
| Grease | `progression-gravitic-knot` | `assets/cards/library/magical-attack-05-1024.webp` |
| Smite | `sacredHarvest` | `assets/cards/library/magical-attack-03-1024.webp` |
| Poison | `viperStrike` | `assets/cards/library/physical-attack-02-1024.webp` |
| Mirrors | `progression-nightglass-reading` | `assets/cards/library/magical-defend-04-1024.webp` |
| Foresight | `astralInsight` | `assets/cards/library/magical-defend-05-1024.webp` |

These existing compositions are visual references only. Their canonical elements, maneuvers and status motifs do not assign mechanics to the proposals. Grease has no exact current Simple illustration; its green shard is an abstract visual reference, not approved oil artwork. Mirrors uses a psychic shield reference rather than claiming newly authored reflection art. Other expanded proposals explicitly reference `starstonePebble` (`magical-attack-04-1024.webp`).

`configureEffectBox` applies one shared centered inset to every hero, expanded and inspection card. The authored rules rectangle (x30, y370, w300, h110 at360×540 design units) becomes x57, y383, w246, h84. It keeps exactly the same center and preserves the parchment, art, title, cost, rank and footer geometry. At280px card width the allowed effect box is approximately191.3×65.3px instead of233.3×85.6px. Text aligns horizontally and vertically through the original flex layer. The native fitter uses design font bounds22–31 with the existing3-line budget; height84 retains its fixed22-unit floor for complete3-line faces. No clauses, words or numbers are removed to fit.


Captures: `hero.png` (three-column, two-row card contact sheet); `overview.png`; desktop 1440×900, wide 2560×1440, tablet 1024×768 and mobile 390×844 (viewport captures); `grease-inspection.png` 1200×900. The hero is generated at viewport 1100×1150 and cropped to the actual `.hero` section, preserving both rows. `capture.mjs` launches Chromium exclusively through `tools/browser.mjs` and closes the browser/profile in a finally block.

`before-hero.png` and `before-smite.png` preserve the preceding painted, larger-text appearance; `hero.png` and `after-smite.png` show the combined smaller-centered-text and Simple-art revision.

`audit.json` records decoded image references, actual text-node rule line counts and layer counts. `all-proposals-audit.json` compares normalized full source face text against visible rendered text across all70 combat/status proposals, detects horizontal/vertical overflow and records centering and font size. Verification: all70 complete, no overflow or non-Simple artwork, fonts17.55–24.06px at280px card width, maximum vertical center deviation under0.008px. All54 featured image instances decode successfully; zero page errors. Screenshots are fresh renders, not edited composites.

For this preserved docs/design location, launch with `ASHENSPIRE_REPO=/absolute/path/to/AshenSpire node server.mjs`. The default repository path targets the original output workspace.
