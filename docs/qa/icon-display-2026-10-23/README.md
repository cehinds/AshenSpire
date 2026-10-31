# Class icon display correction

The named-icon conversion kept readable source IDs but the class choice and
expanded class preview passed those strings directly into their visual wells.
The shared creation visual boundary now resolves the existing engraved icons;
no content IDs, icon geometry, art assets, colours, or game rules change.

Verified with Chromium through `tools/browser.mjs` and Playwright on
`index.html?shot=customize&gameProfile=current`, using the local canonical light
art cache. The default/Core profile was also checked at the same viewports.
Viewports: 390×844, 1440×900, 1920×1080, 768×1024, device scale factor 1;
captures use fullPage. The four-class route renders attack, progression, sword,
and madness as masks, with empty icon-well text; the selected expanded preview
also renders its icon. Before captures with the original boundary reproduce all
four literal IDs. This is icon verification, not a claim that all existing
layout overflow is fixed.

Focused checks: 22 tests pass across named-icon-surfaces, ui-icons,
ui-icon-consumers, and icon-node-slots. Reverting only the boundary fix makes
the new class renderer test fail. The component catalog suite passes 72 tests.
The existing character-creation-components browser tool cannot currently boot
its default-profile catalog: it reports `Class 'starseer' is locked in this
profile`; that unrelated catalog setup was left outside this correction.

Local captures are in `/workspace/scratch/icon-display/` and before captures in
`/workspace/scratch/icon-display-before/`; the integrating session publishes the
review evidence and preview. Capture source: 662512b25 (fixed); original-boundary
before captures use the same source with only visualNode reverted temporarily.

Full-page screenshot extents are identical before and after: 433×938 for the
390×844 viewport, 1200×1600 for 768×1024, 1440×900 and 1920×1080 for the desktop
viewports. The extra phone/tablet extent therefore predates this change.

Additional production `gameProfile=current` shots at 1440×900 rendered engraved
icon DOM in shop (3), reward (15), death (14), and rest (9). Reward and merchant
captures were visually inspected; reward-kind and relic marks remain artwork.
