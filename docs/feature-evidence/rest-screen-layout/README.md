# Shrine rest layout review

**Local source preview:** [Open Shrine of Ember](http://127.0.0.1:8795/index.html?shot=rest&shotRestState=wounded). This loopback URL works only while the local preview server is running; it is not a hosted build.

**Artifact publication is blocked.** The new wide painting needs a canonical art release and then a game pin/derived-manifest update. Writes to `cehinds/AshenSpire-art` returned HTTP 403 through Git and the GitHub integration. No art PR, release, game feature promotion, or hosted artifact was published. The existing published channels do not contain this layout.

The desktop panel is 380 physical pixels wide; widescreen and ultrawide panels are 400. Service descriptions stay 16 physical pixels, with 18-pixel titles. The traveler preserves its aspect ratio and caps at 462 pixels wide; additional screen width does not enlarge it. Tablet and mobile use a scrollable lower tray. Recovery, services, and Continue retain their existing gameplay behavior.

## Gallery

[Wireframe](wireframe.png) · [Desktop](after-desktop.webp) · [Widescreen](after-widescreen.webp) · [Mobile](after-mobile.webp) · [Tablet portrait](after-tablet.webp) · [Tablet landscape](after-tablet-landscape.webp) · [Ultrawide](ultrawide.webp)

![Layout wireframe](wireframe.png)

![Desktop 1440 × 900](after-desktop.webp)

![Widescreen 2560 × 1440](after-widescreen.webp)

![Mobile 390 × 844](after-mobile.webp)

![Tablet portrait 834 × 1194](after-tablet.webp)

![Tablet landscape 1024 × 768](after-tablet-landscape.webp)

![Ultrawide 3440 × 1440](ultrawide.webp)

## Validation

Renderer source commit: `f3e60453ad8d9a954363870747472c066a6c1568`. [Capture provenance](capture-provenance.json) records each actual viewport, UTC capture timestamp, original PNG hash, and renderer file hashes. Captures were taken from the local worktree immediately before the corresponding source commits; these are source previews, not published artifacts.

The flow tested was wounded rest arrival → recovery/services displayed → Level up opens → Escape returns → final service scrolls fully above Continue → flask allocation expands.

The four primary profiles and tablet landscape had no page errors or horizontal overflow. Level up opened in all five. Final-service scrolling and flask expansion passed on mobile, tablet landscape, and desktop. The 3440 × 1440 ultrawide retained a 400-pixel rail and 462-pixel traveler, with no overflow or runtime errors. **Ultrawide is accepted for LOCAL preview.** At widths of at least 2000 pixels and an aspect ratio of at least 2:1, the scene selects the approved expanded 1938 × 812 chapel painting. The traveler/fire anchor follows that image’s actual cover geometry and painted floor. The 3440 × 1440 view retains a 400-pixel panel and 462-pixel traveler, preserves the skyline, and shows more scenery at the sides with one coherent campsite. This generated artwork reinterprets the center; exact source-pixel preservation is not claimed. Other desktop profiles continue using the authored 1672 × 941 painting. Both original high art and the canonical 720p light export loaded successfully; the desktop light export was photographed at 2560 × 1440, and the canonical 1718 × 720 ultrawide light export passed a separate 3440 × 1440 local check with no errors or overflow. Recorded HTTP request origins were exclusively `http://127.0.0.1:8793`; the preview server’s asset fallback is also local loopback. [Light-tier results](light-metrics.json) · [16:9/mobile containment results](containment-metrics.json).

Focused tests: 22 shrine/revisit/one-choice tests and 6 art-policy/distinct-art tests passed. Browser plugin instructions were inspected, but the associated browser JavaScript tool was unavailable; local Playwright and Chromium were used for source preview validation. A separate browser check injected the actual canonical ultrawide light WebP as a data URI into the picture source: at 3440 × 1440 it decoded as 1718 × 720, and resizing to 1440 × 900 selected the authored desktop fallback. Both cases had no errors or overflow. [Data-URI srcset results](data-uri-source-metrics.json). This checks comma-containing data-URI source selection only; no production pack/build validation is claimed while the new art release is unavailable.

Commands from the repository root:

```sh
node --test tests/shrine-one-choice.test.mjs tests/rest-revisit.test.mjs tests/rest-order-revisit.test.mjs
node --test tests/mobile-art-rest-scene.test.mjs tests/mobile-art-distinct.test.mjs
```

[Before/after physical geometry](geometry-before-after.json) · [Interaction results](interaction-metrics.json) · [Ultrawide geometry](ultrawide-metrics.json)

## Reproduce the current local preview

Current source checkout: `/workspace/scratch/rest-screen-layout`, branch `worker/rest-screen-layout`. The canonical artwork preparation is in `/workspace/scratch/rest-art-delivery`.

In one terminal, serve the existing art-capable checkout (already running on port 8766 in this workspace):

```sh
node /workspace/AshenSpire/tools/serve.mjs --port 8766 --no-open --no-lan --host 127.0.0.1
```

In another terminal, from this worker checkout:

```sh
ASHENSPIRE_REPO="$PWD" node docs/feature-evidence/rest-screen-layout/preview-server.mjs
```

This preview-only server serves changed source first and falls back to the existing local art server. Override `ASHENSPIRE_ART_FALLBACK` if that server uses a different URL. Port 8795 is already running in the current workspace; stop that instance before starting another.

Until canonical publication, the source preview needs **untracked local copies** of both `chapel-rest-desktop.webp` and `chapel-rest-ultrawide.webp` under `assets/player-polish/scenes/` and their canonical light twins under `assets-mobile/player-polish/scenes/`. They are deliberately excluded from the game commit. Obtain them from the reviewed art patch in a separate art checkout, or the preparation checkout above. Do not publish this preview-server fallback or bypass the game's release pin for shipping.

Current full-resolution screenshots, capture scripts, and original metrics are under `/workspace/outputs/Feature-updateCharacterCreation/rest-screen-layout/`. Reproduce screenshots in this workspace with:

```sh
node /workspace/outputs/Feature-updateCharacterCreation/rest-screen-layout/capture.mjs after
node /workspace/outputs/Feature-updateCharacterCreation/rest-screen-layout/capture.mjs ultrawide ultrawide
node /workspace/outputs/Feature-updateCharacterCreation/rest-screen-layout/interactions.mjs
```

## Art dependency and continuation

Desktop canonical asset ID: `assets/player-polish/scenes/chapel-rest-desktop.webp`.

| Tier | Dimensions | Bytes | SHA-256 |
| --- | --- | --- | --- |
| High | 1672 × 941 | 472908 | `c9ca548404a596d4b0e36b9c0fbc147b7ba9554b6baf640b910d66909c77a14a` |
| Light | 1279 × 720 | 128362 | `45efc8a65c5995f97bd3008db6431cbd107108d053899bbf8d8f13362aed27ee` |

Ultrawide canonical asset ID: `assets/player-polish/scenes/chapel-rest-ultrawide.webp`.

| Tier | Dimensions | Bytes | SHA-256 |
| --- | --- | --- | --- |
| High | 1938 × 812 | 513234 | `3a110b72437b9ebe76a98f1dde79ecba0e9fa5d6c0e177d160fe17de6b64bb64` |
| Light | 1718 × 720 | 178522 | `23b577935c76def8330bdc2f66de9d8372cc0dc15cf873110d40c4feff979862` |

The desktop exact-path light policy uses a 1280 × 720 ceiling; ultrawide uses 1720 × 720. Both use quality 78, alpha quality 80, and never upscale. Other scenery keeps the existing 256-pixel policy.

[Portable binary art patch](chapel-rest-art.patch) · [Art validation and blocked-write receipt](chapel-rest-art-receipt.md). The portable patch contains the complete local art work through `f1c296ea6c250723966befb30998877548c29b7e`, based on art main `b9daa888a83b0cf430fc606e983673778dec1a2d`, including both runtime image pairs, targeted policies/tests, generated records, original ultrawide PNG master, and exact generation provenance.

After repository write access is restored: apply/review the patch in the art repository → run normal art CI → merge the art PR → publish the next immutable art release → update the game pin and derived manifest through the normal workflow → validate both game tiers/builds → only then promote the game feature. The current game manifest and release pin have not been changed by this work.
