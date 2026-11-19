# Read-only deck view captures

Source commit: 9cd1209048993b09a946c32530eb150b26628d6d.
Local build: 0.7.4.215, digest 8b1b5f1ef1, built with `node tools/launch.mjs --build-only`.
Captured: 2026-11-19 UTC, Chromium, DPR 1; posed map seed1 -> Armoury -> View Deck.
Viewports: mobile390x844, desktop1280x800, wide1920x1080, tablet820x1180.
Playable branch URL: https://cehinds.github.io/AshenSpire/branches/fix/deck-view-spacing/latest/

Sandbox acceptance:44PASS /0FAIL against origin/dev. The title is View Deck, the Pile eyebrow is absent, the body top padding is zero, row spacing is32px, and columns use9px /ui-zoom. The grid retains16px /ui-zoom to avoid clipping cost pennants. Header containment, no header/card overlap and zero console errors pass at all four sizes. Model/DOM regression tests prove viewing preserves the deck and a permitted editor retains Edit Deck.

These are posed source-server captures; the local build was separately compiled. Feature evidence is removed from the integration tree before merge. The source commit's images remain addressable in branch history.

Release gallery verification: published release/latest/build.svg still identifies0.7.3.232, matching the existing README release gallery. Existing release images were preserved.
