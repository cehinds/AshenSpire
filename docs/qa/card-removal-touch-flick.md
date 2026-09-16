# Basic-card removal and touch flick play

Implements issue #854; specification is isolated in PR #855 and must be reviewed
before merging the implementation. Existing draft #836 includes a different
flick contract alongside a reward fix; do not merge both combat-input patches
without reconciling them. This change preserves current dev selection/Information.

Open Settings → Accessibility. Touch flick to play defaults on. Distance is 32–160
viewport CSS pixels, initially 64; the numeric field, slider and Reset share one
value. The practice surface uses the combat recognizer but cannot spend resources.
UI zoom does not change the distance. Upward-dominant motion must meet the selected
distance and recent upward velocity of 300 CSS pixels/second. These defaults are
playtest starting points, not platform mandates. The 12-pixel drag-start threshold
remains separate. Configuration is authored in `balance.ui.touchFlick`.

The selected card, glow, Information button and target highlights retain current
behavior. Flicking does not require a first tap or direct overlap with an enemy.
Nearest targets are computed from the finger in viewport coordinates; equal
distances use entity ID order. Self and all-enemy cards resolve to their own legal
destinations. Invalid resources, cancelled/interrupted input and information
gestures do not flick-play. Direct combatant drops continue to work with flick off.

Merchant and event removal share `cardRemoval.js`. Basic attacks retire their
stable `attack:N` slot; the birth allocation stays unchanged. The optional
`removedAttackSlotIds` ledger crosses run and combat saves and both equipment-swap
paths. An absent ledger means no removals. Item-owned grants remain protected.
The merchant rechecks the current instance, funds and final-card guard before
charging; ordinary card removal keeps its existing semantics.

Validation commands:

```text
node tests/run-node.mjs
node tools/launch.mjs --build-only
node tools/buildversion.mjs --check
node tools/verify-shipped.mjs
node tools/card-removal-flick-qa.mjs
git diff --check
```

Browser QA uses Playwright with local Edge; set `PLAYWRIGHT_MODULE` to an installed
module URL if it is not on the normal module path. `PREVIEW_URL` defaults to
http://localhost:4357; `QA_OUTPUT` defaults to the OS temporary directory's
ashen-card-flick-qa folder. The script records screenshots and a JSON result list.
Phone 390×844, Text XL at the same size, and desktop 1440×1000 exercise the built
game. The merchant check mounts the production source renderer with a disposable
funded run. Headless regressions cover slot removal, restamp, saved fights, swaps,
zero surviving attacks, invalid ledgers, thresholds, velocity, cancellation
geometry, and nearest-target ties. Emulated touch does not establish physical
iOS/Android ergonomics; device playtesting remains useful for tuning the default.

Research: Android ViewConfiguration separates touch slop and fling speed;
Flutter's vertical drag recognizer checks distance and velocity. These are
recognition patterns, not a universal card-game flick distance.

- https://developer.android.com/develop/ui/views/touch-and-input/gestures/viewgroup
- https://api.flutter.dev/flutter/gestures/VerticalDragGestureRecognizer/isFlingGesture.html
