# Applied card art captures

Captured 2026-10-30 UTC with Chromium/Playwright at http://127.0.0.1:4317/docs/card-art-review.html, using the actual renderCard component and the pinned AI-Art v25 release. No authoring override was active. Source commit: 805486258 (art implementation e60792fdf; receipt 4c550f636). The local game build is 0.7.2.4, digest 87d6e7c6c1; the build ordinal remains CI-owned and is not committed.

Viewports: mobile 390×844, desktop 1440×1080, wide 1920×1080, tablet 820×1180. Desktop/tablet show Stone Sling, mobile shows Dissonance, wide shows Fire Counter. These are source review captures, not gameplay screenshots from the hosted build.

Browser sweep: all 156 card recipes and their PNGs loaded, no page/network errors; search, checkbox selection, rotation synchronization, reset, JSON download and PNG download passed. All 73 new component PNGs have alpha transparency. Browser connector control was unavailable; local Playwright used the installed Chromium.

Published feature URL: https://cehinds.github.io/AshenSpire/branches/feature/apply-card-art-library/latest/ (verification blocked by the environment network policy: HTTP CONNECT 403). CI artifact verified via GitHub: https://github.com/cehinds/AshenSpire/actions/runs/41013207417/artifacts/12958626850 (implementation e60792fdf). The existing release gallery was left unchanged; hosted release-gallery verification is blocked by the same policy.
