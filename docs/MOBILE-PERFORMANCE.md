# Mobile performance

AshenSpire keeps its headless engine and DOM UI. Rendering quality changes
presentation only; it does not alter damage, resources, targeting, saves or RNG.

## Builds

Since docs/EXTERNAL-ASSETS-PLAN.md step 8e, `node tools/launch.mjs --build-only`
writes one tree into `build/` and `dist/` (`--full-art` for release/main's
high-default build):

- `build/AshenSpire.html` and `dist/AshenSpire.html` are the game file, about
  10 MB of code with no media inside it. Its art, fonts, map tiles and score are
  objects in `objects/`, listed by the pinned pack indexes in `packs/`
  (`asset-base.json` beside it), and are requested separately when used. It picks
  its tier at runtime: Settings → Display → Art quality, where *Auto* takes the
  light pack on a narrow layout, a phone-sized screen, Save-Data or a
  low-memory device (step 8c). Serve or copy the whole directory; the folder
  also plays by double-click while it stays together.
- `build/download/AshenSpire.html`, `dist/download/AshenSpire.html` and the root
  `AshenSpire.html` are the **light single file**: the same build with its art
  inlined from the light pack's `assets-mobile/` (every image with a side of 384 px or more scaled
  to 5/16, 512 → 160, all re-encoded lossy, `tools/mobileart-policy.mjs`: q35,
  alpha q40; full-screen backdrops under `environments/`, `bg/` and `map/` keep
  0.4 scale at q50, because a 1536-wide backdrop at 5/16 blocks visibly across a
  phone). It is ~31 MB on 0.7.1 (the retired mobile file's 30 MB budget is an
  open owner question for it; `verify-shipped.mjs` prints the size against it),
  with the inlined art itself held under 20 MB by `mobile-art.mjs --check`. It
  is the build's *Download* on Pages (`/<branch>/<ordinal>/download/`).
  The twins are generated, and `mobile-art.mjs --check` run, in
  `cehinds/AshenSpire-art` since docs/EXTERNAL-ASSETS-PLAN.md step 13; here a
  fetch (`node tools/fetch-art.mjs --pack light`) verifies every light file
  against `art-manifest.json`. Settings → About names the tier.
- The separate mobile file (`AshenSpire-mobile.html`, `bundle.mjs --mobile`) and
  the full-art single file (~253 MB) are retired (owner answers 2 and 6).

Production hosting should cache individual versioned asset URLs and compress
HTML; the Pages service worker (step 6b) keeps a build for offline play. The
development server deliberately does not claim production caching.

`tools/assetmime.mjs` excludes the unused `assets/equipment/components/`
authoring experiments from both outputs. The art source remains in git.
Other runtime asset families still ship in full, including paths constructed
from content IDs. The exclusion is part of build identity and has a regression
test against source references. Windows SVG comparisons normalize the same line
endings as the bundler.

## Rendering and input

Settings → General → Combat → Animation & effects → Rendering quality offers
Auto, Full and Lite. Auto uses
Lite for a coarse primary pointer and Full otherwise. An explicit choice wins.
Lite removes expensive sprite filters and cloned target silhouettes, replacing
the latter with the same relationship color on a ground ring. It disables ambient
effects and shake and skips optional pose preloads. Pose animation, enemy state
art and the idle bob still play in Lite (owner, 2026-10-04): a phone used to
get frozen figures. Without preloads, a pose's first play on a phone may hold
its previous frame until the new one loads. The Reaver's 3.36-second sequence
stays off in Lite (below). State badges, inspection, target previews and hit feedback
remain.

Combat pacing also offers Auto: Fast with Lite, Normal with Full. Existing
saved explicit pacing is preserved. Lite uses the normal short action feedback
instead of the special 3.36-second Reaver sequence.

Combat retains each combatant frame and sprite host. Unchanged presentation
inputs skip rendering; changed slots update without rebuilding the animation
host or rebinding frame input. Unchanged hand cards retain their identity.
Changed previews, affordability, order or hand size invalidate their face and
input closure. Non-solo consumers retain their existing remount behavior.

Card fitting batches reads and writes by fitting stage. It reruns for new cards,
window resizing, font readiness and display-setting changes. Pose preloads share
a four-group LRU working set; Lite and reduced motion create no preload objects.
Screen teardown disconnects observers, releases card inputs and stops stages.

## Verification

```
node --test tests/mobile-performance.test.mjs
node tests/run-node.mjs
node tools/launch.mjs --build-only
node tools/buildversion.mjs --check
node tools/verify-shipped.mjs
node tools/fetch-art.mjs --pack light,common --recheck
node tools/verify-external.mjs
node tools/plantsites.mjs --check
```

Browser QA covers 390×844 touch and 1440×900 desktop: combat load, selection
without play, Information → Play, an enemy turn, the next hand, and Armoury.
Both external-art and standalone HTML also run through the phone flow. A CDP
touch sequence with explicit timestamps verifies one flick commits one card
after repeated render calls in both Lite and Full modes.

An unchanged-state stress probe calls the real combat renderer twenty times.
The initial current-dev baseline replaced player/enemy frames, player sprite and
hand cards, with 760 added/removed DOM nodes. This implementation preserves those
identities and records 120 added/removed nodes. Wall time is machine-dependent;
these are local Edge measurements, not a physical-phone benchmark or proof that
the reported mobile crash is fixed. Physical iPhone/Safari testing and a longer
session memory trace are still needed.

The older card-drag-targeting harness currently reads `.pile.discard .n`, which
predates the combined Discard/Exhaust control; its full run stops at that stale
selector. The focused touch and gameplay checks above cover the current flow.

See [screenshots](preview/mobile-performance/) and the
[component catalog](component-catalog.html).
