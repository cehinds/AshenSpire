# Chapel rest art delivery receipt

Prepared commit: `d606aaece937379261cd1591ab5cd6811ae11145` on local `art/chapel-rest-backdrop`, based on art main `b9daa888a83b0cf430fc606e983673778dec1a2d`.

Canonical asset ID: `assets/player-polish/scenes/chapel-rest-desktop.webp`.

| Tier | Dimensions | Bytes | SHA-256 |
| --- | --- | --- | --- |
| High (unchanged authored painting) | 1672×941 | 472908 | `c9ca548404a596d4b0e36b9c0fbc147b7ba9554b6baf640b910d66909c77a14a` |
| Light (canonical cwebp 1.5.0 export) | 1279×720 | 128362 | `45efc8a65c5995f97bd3008db6431cbd107108d053899bbf8d8f13362aed27ee` |

Six files add the high/light pair, generated provenance and manifest record, and a focused first-match policy override plus regression test. Only this chapel image receives the 1280×720 scenery ceiling, quality 78 and alpha quality 80. Other scenery retains its current 256px rule.

Validation: 20 applicable unit tests pass; mobile-art selftest catches all 17 known bad cases; actual new twin dimensions, policy, hashes, provenance and generated manifest row pass; git diff --check passes. Sparse checkout excludes the committed full-tree test. Full manifest, complete light-tree budget and reproducible three-pack checks remain required in normal CI. The generated manifest/provenance preserve unchanged committed records and add canonical-builder output for the new file only.

Blocked step: `git push -u origin art/chapel-rest-backdrop` returned HTTP 403, "Permission to cehinds/AshenSpire-art.git denied to cehinds." Root independently confirmed GitHub integration branch creation returns 403, "Resource not accessible by integration." No remote branch, PR, merge or release was created. External writes stopped.

Reviewable binary patch: `chapel-rest-art.patch` beside this receipt. Local canonical light file: `/workspace/scratch/rest-art-delivery/light/assets/player-polish/scenes/chapel-rest-desktop.webp`.

After repository write access is restored, normal delivery is art feature branch → reviewed PR → pack CI → merge to art main → automatic next-unused immutable art release → game PR pin and derived manifest update. Do not ship the new runtime asset reference against the existing release pin.
