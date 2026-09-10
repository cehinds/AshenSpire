# Mobile performance

AshenSpire keeps its headless engine and DOM UI. Rendering quality changes
presentation only; it does not alter damage, resources, targeting, saves or RNG.

## Builds

Run `node tools/launch.mjs --build-only` to generate both editions:

- `AshenSpire.html`, `build/AshenSpire.html` and `dist/AshenSpire.html` are the
  portable single-file game.
- `build/web/AshenSpire.html` with its sibling `assets/` and `map-detail/` trees
  is the web edition. Serve/copy that entire directory. Images are requested
  separately when used. Copying just its HTML will not work offline.

The external-art bundler already existed; this change makes the normal launcher
produce it as well. It does not deploy either edition or change the Pages site.
Production hosting should cache individual versioned asset URLs and compress
HTML. The development server deliberately does not claim production caching.

`tools/assetmime.mjs` excludes the unused `assets/equipment/components/`
authoring experiments from both outputs. The art source remains in git.
Other runtime asset families still ship in full, including paths constructed
from content IDs. The exclusion is part of build identity and has a regression
test against source references. Windows SVG comparisons normalize the same line
endings as the bundler.

## Rendering and input

Settings → Display → Rendering quality offers Auto, Full and Lite. Auto uses
Lite for a coarse primary pointer and Full otherwise. An explicit choice wins.
Lite removes expensive sprite filters and cloned target silhouettes, replacing
the latter with the same relationship color on a ground ring. It disables ambient
effects and shake, skips optional pose preloads, and loads enemy state art on
demand. State badges, inspection, target previews and hit feedback remain.

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
