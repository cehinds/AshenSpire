# Publication verification

Verified October 10, 2026 from the packaged repository copy on Windows, with Edge via Playwright. The Browser plugin was unavailable; the existing Playwright interaction suite was used.

- The portable launcher served the copied package at `http://localhost:8362/`. The document title and URL identified HUD Component Studio, and the complete scene rendered at 1440 × 1000.
- The interaction suite passed canvas/tree selection, text/image dragging, leaf/group resizing, text color and opacity changes, visibility, layer ordering, duplicate/delete/undo/redo, all three selection views, state isolation, refresh persistence, JSON export/import roundtrip, 512 × 960 full-view PNG export, and reset cancel/confirm/undo.
- At 390 × 844, all measured toolbar controls remained within the viewport. No page/console errors or failed requests were recorded. This is an editor viewport check, not physical-phone game acceptance.
- `node qa/verify.mjs` passed the 224-node graph, unique IDs, acyclic parents, state/asset references, 38 asset checksums, reference checksum, and portable source paths. The packaged HTML, seed scene and reference are byte-identical to the reviewed source. CSS and JavaScript only have line-ending/trailing-blank-line normalization; their executable content is unchanged.
- Root review approved the portable launcher, dependency/output configuration for QA, provenance records, guides, component-catalog entry, credits and copied font notices. Earlier source review covered all three rendered states and transparent component PNG bounds/edges.

The original complete repository invocation (`node tests/run-node.mjs`) discovered 434 files and ran 3,631 tests, with three failures caused by the fresh checkout missing its pinned `hd-assets-v19` art packs. `node tools/fetch-art.mjs --pack all` verified the high, light and common packs. Rerunning the exact affected files (`asset-pack.test.mjs`, `book-art.test.mjs`, `music-score.test.mjs`) passed 26/26 tests with zero failures or skips. The full invocation finished with 167 passed and one failed aggregate (exit 1), solely the initial missing-pack discovery failures. Every remaining core/self-test gate passed, including 1,556 module graphs, 22 UI component contracts, the unchanged copy baseline, credits, generated content/config and seeded-run checks. Together with the affected-file rerun, no failures remain unresolved. Passed slow balance/discovery checks were not repeated.

To repeat the editor checks, serve this directory, provide Playwright to Node, and run:

```powershell
node qa/verify.mjs
$env:HUD_STUDIO_URL = 'http://localhost:8360/'
$env:HUD_STUDIO_BROWSER = 'msedge'
node qa/smoke.mjs
```

Screenshots and exported test layouts are written to the ignored `qa/artifacts/` folder by default; set `HUD_STUDIO_ARTIFACTS` to choose another destination. Disposable captures, server logs and browser drafts are not part of this source package.

This publication targets the requested `Chore/FixCombatUi` branch. Its workflow filters do not automatically run release/game CI for this branch. The standalone authoring tool has not been promoted to Dev/Test or published as a game build.
