# Corrected Core build captures

Source **bef792958e13411064aa7befed38af600c5b2f26**; official local light build **0.7.1.1773 / 6fc71c88a1**. Captured 2026-10-22 UTC. [Capture record](capture-record.json) gives viewport sizes, artifact/source hashes and exact URLs.

The four real views use the production `?shot=combat&shotSeed=SHOWCASE&shotClass=reaver` starting pose, not a completed playthrough. Root and the QA agent inspected mobile375×667, desktop1440×900, wide1920×1080 and tablet768×1024; a fifth390×844 phone capture also passed. The native375 smoke then selected/inspected/targeted/spent one Strike once, completed End Turn, reconciled9+9+20 damage with floats/log/HP71→33, and checked SP/current/last/deck/cost/effects through Inspector. No page or asset errors; timeline watchdog0.

[Successful CI build and download artifact](https://github.com/cehinds/AshenSpire/actions/runs/39863729665), artifact `feature-preview-bef792958e13411064aa7befed38af600c5b2f26`, is the review fallback. CI logs identify the matching1773ordinal and6fc71c88a1digest. The local official pack's8,169references,7,881object hashes and15font faces were independently verified. [Public feature route](https://cehinds.github.io/AshenSpire/branches/fix/CoreRenewal/latest/) remains **unverified**: deployment checks did not establish matching public source. This route is not presented as a working verified preview. Promoted Test delivery remains a separate final check.

Release0.7.1.1517/source d310c277fffaaec6ec7a58a87de846577f12312d is unchanged; its existing gallery is retained. This feature-only folder and README block are removed before merge, with this review commit retained as evidence.
