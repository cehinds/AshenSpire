# Card flick input parity

Issue #868; specification #869; implementation #870.

The reported drag showed `NO TARGET` while enemies were available. Combat gated
the flick recognizer on `pointerType === 'touch'`; practice did not. Reproducing
an upward mouse drag on the previous code left the hand and enemy health unchanged.

Combat now sends all primary pointer gestures through the existing recognizer.
An upward flick beyond the configured distance picks the nearest living enemy
and revalidates on release. Mouse, trackpad dragging, touch and pen share settings.
The visible controls say Card flick; persisted setting keys stay compatible.
Selection, Information, direct drops, velocity and cancellation rules are preserved.

## Validation

`tools/card-flick-pointer-qa.mjs` drives the real combat screen through native
Chromium mouse, touch and pen input. It supplies no event timestamps: events are
queued at normal input cadence without waiting for a full browser round trip
between movements. Assertions cover selection, Information, short movement,
paused release, cancellation, configurable distance, disabling flicks, one play,
release outside every enemy and damage to only the nearest legal enemy.

The browser supplies coordinates, pointer types and event times. Trackpad dragging
uses the browser's mouse pointer stream. This is browser automation, not testing
on physical touchscreens, pens or trackpads. Existing deterministic touch tests
remain useful for routing and cancellation, alongside this real-time regression.

Run with the installed Playwright module and Edge:

```powershell
$env:PLAYWRIGHT_MODULE = 'file:///absolute/path/to/playwright/index.mjs'
$env:PREVIEW_URL = 'http://localhost:4357'
node tools/card-flick-pointer-qa.mjs
node tools/card-removal-flick-qa.mjs
```

The default route tests the rebuilt standalone game. `QA_ROUTE=/index.html?shot=combat`
tests source instead. `QA_OUTPUT` chooses the directory for assertions, pointer
traces and preview screenshots. The component catalog documents the shared controls.
