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
- Phones use the Pages *Play* link (`/<branch>/latest/`, the pack build). The
  Pages *HTML* link (`/<branch>/latest/download/AshenSpire.html`) is the offline
  desktop file: ~132 MB, 15–80 s to open on a phone and ~440 MB of memory there.

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
effects and shake and skips optional pose preloads. Pose animation and enemy
state art still play in Lite. Fighters remain still while idle in every
rendering style; attacks and reactions retain their animation. Without preloads, a pose's first play on a phone may hold
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

### Core interaction comparison, 2026-10-22

The strict six-run comparison of 1770 and runtime `25aed259` at 375×667,
DPR3 and 4× CPU found complete-action median reductions of 6.9% for Defend
and 9.7% for Strike. Script work fell about 31%, but style work and median
maximum frame gaps increased. The requested 2×/4× goals remain unmet and
visible stalls persist. These are warmed local Chromium results under shipped
defaults, with every sample retained; the Mobile fast preset was not selected.
See the [full protocol, samples and correctness limits](qa/core-renewal-2026-10-22/README.md).
Actual Galaxy A32/iPhone SE/Safari verification remains outstanding.

### Compiled startup profile, 2026-10-20

Two local standalone builds were measured in Chromium 154 at 390×844, DPR 3,
with touch enabled and CPU throttling off. Build **0.7.1.1735** at
`47f9d36ab9c29ff873d56ab6d16251e787cbb98b` took 4.714 s to DOMContentLoaded,
5.296 s to show the startup gate, and 9.382 s from navigation to the title;
its longest main-thread task was 4.034 s. Build **0.7.1.1739** at
`37ee041ee715c179a6895a1fcb00dc9b4bcdede8` (artifact digest
`68381ee86d`) took 3.035 s to DOMContentLoaded, 3.272 s to show the gate,
and 7.166 s from navigation to the title; its longest task was 2.480 s.
The new build reduced navigation-to-title time by 2.216 s in this run. The
gate-to-title interval still includes the authored 3.440 s intro (560 ms
light-up, 2,000 ms hold, 880 ms fade); the remainder was about 0.454 s.

Samples from the remaining startup task include legacy profile cloning,
content validation/digest work, audio setup and freezing the profile. This is a
local Chromium comparison between the listed builds, not a measurement on a
Galaxy A32, iPhone, or Safari. A deterministic real-touch `core.defend` play
also committed exactly once and removed its card at 390×844 and 320×568 under
4× CDP CPU throttling. Its post-input window contained 0.719–0.908 s long tasks
and missed frames, but the probe's requestAnimationFrame timestamps were stale
in places, so no touch-to-action latency is reported from that run. A dedicated
interaction CPU profile is still needed before attributing those stalls or
choosing an optimization.

The card-drag-targeting harness reads the live combat state's discard count,
separately from exhaust, for its exact-once checks. The combined Discard/Exhaust
control displays both counts and has no separate discard counter selector.
A focused fixture checks this distinction and rejects missing or duplicate
discard commits; the full manual browser corpus was not rerun for this repair.
The focused touch and gameplay checks above cover the current flow.

See [screenshots](preview/mobile-performance/) and the
[component catalog](component-catalog.html).
