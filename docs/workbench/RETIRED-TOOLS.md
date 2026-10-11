# Retired tools: where each old page now lives

The old standalone pages still work. None redirects. Each one that a Workbench
module replaces, fully or in part, shows a notice at the top (the shared script
`workbench/retired-banner.js`, or markup and CSS for the three standalone apps,
whose Content-Security-Policy and server do not serve the script). The notice
links to the module's deep link and has "Keep using this page" to dismiss it.
The Library (`workbench/tools.json`, the `moved` object) marks each one
"Moved to <module>" and lists it below the live and legacy pages.

Source of truth: `workbench/tools.json` (`moved`). The tests in
`workbench/tests/retired.test.mjs` check every link with `parseHash` and that
each moved page carries its notice.

Counts: **6 fully replaced**, **24 partly replaced** (30 registry entries).

## Mapping

Coverage: *full* means the module does what the page does. *partial* means the
module covers the main job; the missing features are listed and still only in the
old page.

| Old tool | Path | Module | Deep link | Coverage | Still only in the old tool |
|---|---|---|---|---|---|
| Component Catalog | `docs/component-catalog.html` | Entity Browser | `#mod=entities` | full | none |
| Every weapon | `weapon-cards-preview.html` | Entity Browser | `#mod=entities&kind=armaments` | full | none |
| Painted Armory | `items-preview.html` | Entity Browser | `#mod=entities&kind=armor` | full | none |
| Item card review | `item-cards-preview.html` | Entity Browser | `#mod=entities&kind=armor&view=worn` | full | none |
| Held stances | `pose-studio/stances/index.html` | Motion Studio | `#mod=motion` | full | none |
| Stance options (2026-10-08) | `pose-studio/stances/options-20261008/index.html` | Asset Gallery | `#mod=assets` | full | none |
| Layered Battlefield Editor (legacy) | `docs/design/combat-depth-2026-10-05/editor/editor-legacy.html` | Layout Studio, Battlefield | `#mod=layout&mode=battlefield` | partial | group and ungroup, lock, marquee selection |
| Combat Studio | `docs/design/combat-depth-2026-10-05/editor/battlefield-wireframe-editor.html` | Layout Studio, Battlefield | `#mod=layout&mode=battlefield` | partial | parallax and effect preview |
| Armament combat kits | `armament-kits-preview.html` | Entity Browser | `#mod=entities&kind=armaments` | partial | loadout compare |
| Card and tooltip playtest | `tooltip-review.html` | Entity Browser, Tooltip tab | `#mod=entities&view=tooltip` | partial | hover-timing lab |
| Alternative animation atelier | `pose-studio/renewal/index.html` | Motion Studio | `#mod=motion` | partial | card-action preview by class; rig download |
| Pose & FX Studio (standalone app) | `pose-studio/index.html` | Motion Studio | `#mod=motion` | partial | editing bindings (Motion Studio shows them read-only); Sequence mode (not built) |
| Content Editor (standalone app) | `editor/index.html` | Data Studio | `#mod=data` | partial | sprites; scripts; relation builder; Codex |
| UI Studio (standalone app) | `ui-studio/index.html` | Layout Studio, UI config | `#mod=layout` | partial | Settings tab (not yet located in Layout Studio, to confirm); Values tab as a typed table |
| Low-Poly Fighters, painted poses | `docs/low-poly-fighters/index.html` | Asset Gallery | `#mod=assets` | partial | saved view of this page |
| Board fidelity components | `docs/design/board-fidelity-2026-10-04/index.html` | Asset Gallery | `#mod=assets` | partial | saved view of this page |
| Class armor review | `docs/design/class-armor-rear-2026-10-06/index.html` | Asset Gallery | `#mod=assets` | partial | saved view of this page |
| Player polish inspiration | `docs/design/player-polish-2026-10-01/index.html` | Asset Gallery | `#mod=assets` | partial | saved view of this page |
| Player polish asset kit | `docs/design/player-polish-asset-kit-2026-10-02/index.html` | Asset Gallery | `#mod=assets` | partial | saved view of this page |
| Player component collection | `docs/design/player-components-2026-10-03/index.html` | Asset Gallery | `#mod=assets` | partial | saved view of this page |
| Combat art study | `docs/design/combat-depth-2026-10-05/index.html` | Asset Gallery | `#mod=assets` | partial | saved view of this page; layered scene with device and depth switches |
| Combat art continuation | `docs/design/combat-depth-2026-10-05/continuation/index.html` | Asset Gallery | `#mod=assets` | partial | saved view of this page; layered scene with device and depth switches |
| Responsive text comparisons | `docs/preview/responsive-type/index.html` | Visual Review | `#mod=review` | partial | zip download; verdicts export; screens not in the capture job list |
| Combat formation | `docs/preview/combat-formation/index.html` | Visual Review | `#mod=review` | partial | zip download; verdicts export; screens not in the capture job list |
| Combat ground review | `docs/preview/combat-ground/index.html` | Visual Review | `#mod=review` | partial | zip download; verdicts export; screens not in the capture job list |
| HUD follow-up | `docs/preview/hud-followup/index.html` | Visual Review | `#mod=review` | partial | zip download; verdicts export; screens not in the capture job list |
| Concise card tooltips | `docs/preview/concise-card-tooltips/index.html` | Visual Review | `#mod=review` | partial | zip download; verdicts export; screens not in the capture job list |
| Starting equipment review (screenshots) | `docs/preview/starting-equipment/index.html` | Visual Review | `#mod=review` | partial | zip download; verdicts export; screens not in the capture job list |
| World Journey screenshot review | `docs/preview/world-atlas/index.html` | Visual Review | `#mod=review` | partial | zip download; verdicts export; screens not in the capture job list |
| HUD comparison (approved vs built) | `docs/qa/mobile-combat-20261009/hud-comparison.html` | Visual Review | `#mod=review` | partial | zip download; verdicts export; screens not in the capture job list |

## Not moved (the module is not built, so the old tool stays live with no notice)

| Old tool | Path | Planned module | Why it stays |
|---|---|---|---|
| Deck row layout editor | `docs/design/deck-row-editor/index.html` | Layout Studio, Deck row | Mode not built (`workbench/modules/layout/modes.mjs`) |
| SP Atelier | `docs/design/sp-orb-editor/index.html` | Layout Studio, SP orb | Mode not built |
| Book Atelier | `docs/preview/book-library/layers/atelier.html` | Layout Studio, Book recipes | Mode not built |
| Card layer explorer | `docs/qa/card-layers/index.html` | Layout Studio, Card layers | Mode not built |
| Pose Studio Sequence (prologue studio) | `art/prologue-2026-09-19/index.html` (art checkout) | Motion Studio, Sequence | Not built; art repo |
| Scenes & Fixtures (world atlas, reading desk, equipment selection, tooltip scenes, live QA fixtures, tray gallery, wireframe gallery) | see `workbench/tools.json` | none | Stays as it is, by plan (CONSOLIDATION §G) |
| Combat art in game (`docs/design/combat-depth-2026-10-05/game-preview.html`) | — | none | A game-preview page, not a gallery |
| Generator templates (`*-template.html`) | `docs/design/*/gallery-template.html` etc. | none | Build inputs, not tools to use |
| Art-repo pages in the Asset Gallery and Visual Review plans (sprite catalog, tag mappings, WebP pack desk, painted combat) | `art/…` in `cehinds/AshenSpire-art` | Asset Gallery | External checkout; not edited from this repo |

## Remaining gaps, by module

- **Layout Studio:** deck-row, SP orb, book recipes and card layers modes (not built); group, lock and marquee selection; parallax and effect preview; UI Studio's Settings and Values tabs (to confirm).
- **Data Studio:** sprites, scripts, relation builder, Codex (the Content Editor's); the Tag Workbench is on `feature/TagRefactor`, not in this checkout.
- **Motion Studio:** card-action preview by class; bindings editing (read-only today); Sequence mode; rig download.
- **Entity Browser:** loadout compare; hover-timing lab.
- **Asset Gallery:** saved views (each frozen page as a view of the gallery); tag-to-effect rules view; layered scene with device and depth switches.
- **Visual Review:** zip download; a verdicts export (Accept as baseline is the only approval); the hand-made pages' screenshots are not in the capture job's screen list (`workbench/modules/review/model.mjs`, `SCREENS`).

## Unverified

- The notices were not viewed in a browser. Inserting a bar at the top of a page can shift a fixed-height layout; check the standalone apps (Content Editor, UI Studio, Pose Studio) and the Asset Gallery pages once in a browser.
- The "still only here" lists come from reading module source, not from a feature-by-feature test of each old page. Items marked "to confirm" were not located in the source.
- The notice's Workbench address defaults to `http://127.0.0.1:4300/` (the Workbench port). Pages opened on another host need `data-workbench` set.
