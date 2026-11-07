# Release candidate 0.7.1.1517 screenshots

Real browser captures of the actual published Release-channel build, taken **2026-10-15 UTC**. This gallery refresh does not certify release acceptance or represent an earned campaign run. The historical `0.7.1.1060` gallery remains preserved under its original directory.

- Channel/version: `release`, **0.7.1.1517**; [play this exact published build](https://cehinds.github.io/AshenSpire/release/1517/).
- Published source commit: [`d310c277fffaaec6ec7a58a87de846577f12312d`](https://github.com/cehinds/AshenSpire/commit/d310c277fffaaec6ec7a58a87de846577f12312d); source digest `a5b5079cb1`; built `2026-10-14`.
- Published metadata: `edition=full`, `shape=pack`, `tier=high`. Actual executed HTML stamps: `SOURCE=a5b5079cb1`, `ORDINAL=1517`, `EDITION=high`, `RUN_PATH=standalone file`.
- Each actual public browser navigation returned **15,057,883 bytes** with SHA-256 `4a8f3df4f2b5d54819691661e2d1cfa9c2a0179da7ba8efe4090cd41fce519cd`, matching the fixed public `build.json` page hash. Numeric and `latest` metadata agreed at capture time.
- Capture run: [38699217698](https://github.com/cehinds/AshenSpire/actions/runs/38699217698), [five PNGs and raw identity manifest](https://github.com/cehinds/AshenSpire/actions/runs/38699217698/artifacts/11954519235). Artifact ZIP SHA-256: `4ab4a526f25dde263b920841af51d84e1c4590080547284c365bc135d7b758e9`.
- Read-only capture helper: [worker `ee33d73be`](https://github.com/cehinds/AshenSpire/commit/ee33d73be), following the states and landmark checks in `tools/release-shots.mjs`. The workflow has only `contents: read`; it neither builds nor publishes the game.
- Browser: Chromium `155.0.8059.39` on Linux. Desktop 1440 × 1000, phone 390 × 844, device scale 1; phone uses viewport/touch emulation, not a physical device.
- Captured between `2026-10-15T07:30:39Z` and `2026-10-15T07:31:12Z`. Every image was inspected after download.

## Capture states and image hashes

| Image | Executed public screenshot state | Viewport | PNG SHA-256 |
| --- | --- | --- | --- |
| `creation.png` | [?shot=customize](https://cehinds.github.io/AshenSpire/release/1517/?shot=customize) | 1440 × 1000 | `5d90f4b7b5966cc561e72fba62bf83da38804b352648c3ccfa5bc4c51ec761d2` |
| `map.png` | [?shot=map&shotWalk=5](https://cehinds.github.io/AshenSpire/release/1517/?shot=map&shotWalk=5) | 1440 × 1000 | `74fb7b2f207f92febfb64ed6695c50e8f3c219c2c118525a9c3d51637047c614` |
| `combat.png` | [?shot=combat](https://cehinds.github.io/AshenSpire/release/1517/?shot=combat) | 1440 × 1000 | `99a60ed9da60be998e3d70b9818b7d8689e86c27b99f7a2182ead083ed03f759` |
| `shop.png` | [?shot=shop](https://cehinds.github.io/AshenSpire/release/1517/?shot=shop) | 1440 × 1000 | `d76f0c78a26cf9884d6f08d2f2735140b68569095f1a15f7b77e0531c847ee85` |
| `combat-phone.png` | [?shot=combat](https://cehinds.github.io/AshenSpire/release/1517/?shot=combat) | 390 × 844 | `c6fb0b2ed534b7b3641312e55a3fa00d6133619951ba2f3ad6772c10db83a868` |

The game's existing `shot` query states pose reproducible screens in an ephemeral screenshot save. The map poses a five-step route, and the merchant uses showcase inventory/currency. Screens are reached on the actual public numeric URL; no game source, art, DOM state, event listeners or runtime functions are replaced. Screenshots wait for the requested landmark, fonts, decoded visible images and background images, and painted combatants. These showcase screens do not display the menu's textual build stamp; identity is established by the exact navigation bytes and their embedded stamp, not a claimed visible stamp in the PNGs.

All five navigation URLs above were executed as written, without redirection. All page hashes, embedded identities, screen landmarks, decoded art and combatant paint checks passed. There were **zero runtime exceptions and zero network failures**. Chromium reported two blocked `navigator.vibrate` calls before a user tap, on desktop and phone combat; the raw manifest preserves them. This is not a zero-console-error claim.

The earlier read-only capture attempts [38698607567](https://github.com/cehinds/AshenSpire/actions/runs/38698607567) and [38698824537](https://github.com/cehinds/AshenSpire/actions/runs/38698824537) failed before screenshots because Playwright's inspector cache evicted the large HTML response before hashing. Those failure artifacts remain preserved. The successful run reads the actual navigation's bytes through the same buffered CDP session and observed request ID, with no second fetch or relaxed hash check. An independent agent reviewed the corrected transport and found no blocking issue.

Raw manifest remains in the linked workflow artifact and local scratch `/workspace/scratch/full-combat-audit/release-gallery-1517-ee33/manifest.json`; only the five curated images and this bounded capture record are committed.

## Refreshing the gallery

Check the public Release history and small metadata first. Pin the numeric build URL, confirm its source/commit/hash against the actual browser response, reuse these five existing screenshot states, inspect all images, and record a new version directory. Keep older captures labeled with their original identity. This gallery concerns the published Release channel; newer Dev/Test features have their own evidence.
