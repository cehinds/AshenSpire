# Reading Desk screenshots

Captured on 2026-10-16 in headless Chromium using `tools/browser.mjs` and `tools/serve.mjs`, serving unbuilt source at `/deck-reading-desk-preview.html`. These are source-screen captures, not deployment or packaged-build evidence.

## Latest revision

The large-preview revision is implemented by `fb6b4f943`, `2959a61fc` and `5226507a0`, based on integrated source `5f3eeca32`. The captures below use `5226507a0` and an isolated seed-7 Reaver run. The browser harness binds the actual `core` or `current` game profile with `resolveGameProfile`, `applyGameProfileToContent` and `bindGameProfileRegistries` before mounting the production deck editor.

| Image | Viewport / state |
| --- | --- |
| [Current desktop](after-desktop.png) | 1440 × 900; 11-card current starter; equivalent Slashing Strike copies combined as 2/∞ |
| [Core desktop](after-core-desktop.png) | 1440 × 900; ten-card core starter in six distinct rows |
| [Core short desktop](after-core-short-desktop.png) | 1366 × 768; 280px card; complete selected description and all six starter rows visible |
| [Current short desktop](after-current-short-desktop.png) | 1366 × 768; 280px card; complete selected description visible; larger library scrolls |
| [Current mobile list](after-mobile-list.png) | 390 × 844; all owned cards available without scope tabs |
| [Current mobile inspection](after-mobile-inspection.png) | 390 × 844; selected card and main effect description |
| [Optional animation](after-desktop-animation.png) | 1440 × 900; checked checkbox replaces the card face while retaining its description |

The fixture loads base, UI, kit and responsive type styles. The harness additionally loads `illustrated-cards`, `combat-poses`, `alternative-combat`, `combat-layers` and `player-polish`, matching the relevant game styles omitted by the fixture. The source server used the available light artwork pack because the high pack was not fetched.

## Checks

- `node --test tests/deck-editor.test.mjs tests/deck-card-animation-preview.test.mjs tests/deck-editor-collection-rows.test.mjs`: 80 passing tests. Coverage includes immediate selection updates, equivalent-row counts, actual-instance removal, restoring an owned copy before minting, preserving different effects/upgrades/ranks, Cancel confirmation and Keep editing, actual minimum validation, half-speed playback, one-second loop pause, and preview disposal.
- Chromium core and current profiles at 1440 × 900: card width 300px; selected complete main effect description visible; core's six rows and current's eleven unique rows fit without list scrolling; only Cancel and Accept appear in the footer; no All/In Deck tabs or duplicate right-hand count heading.
- Chromium at 1366 × 768: card width 280px and selected main effect description visible. The ten-card core starter's six distinct rows fit without scrolling. The current profile's eleven unique collection rows require approximately 126px of list scrolling at this height; fonts and controls are not scaled down.
- Both profiles: removing a card below the run's configured minimum disables Accept; the current/minimum counter turns red (`rgb(255, 148, 136)`) and Accept turns gray (`rgb(58, 56, 52)`). Cancel opens the shared unsaved-edit confirmation. Keep editing preserves the edited deck; Escape followed by Discard restores the opening deck; valid Accept saves. Checking Show animation replaces the face and retains its description.

Long derived combat rules, tag explanations and keyword reference prose are available in the expandable Rules and keywords section. Main effect descriptions remain outside that section. Mobile lists can scroll when the collection is longer than the viewport. These captures do not verify every card, language, text-size setting, browser or equipment combination.

## Earlier comparisons

- [Original three-column desktop](before-desktop.png): source `593d61962f81ff658ca55607dcb834db9e7d6feb`, 1440 × 900.
- [Previous compact desktop](previous-compact-desktop.png): source `087880ede`, 1440 × 900. This 180px preview was superseded by the larger card above.
