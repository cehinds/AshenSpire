# Mobile performance review

Build 0.6.0.114, source digest `f29392cf5c`, based on dev `1400f7d5`.

Captured in local headless Edge with Playwright, 390×844 touch and 1440×900 desktop, device scale 1. The gameplay QA uses fast pacing and hold confirmation off; the timestamped flick preview uses the normal fixture settings. These are browser-emulated phone layouts, not physical-device captures.

- [Phone: external-art build](phone-web-combat.png)
- [Desktop combat](desktop-combat.png)
- [Phone: Information and Play from standalone file](phone-offline-inspection.png)
- [Phone: Lite target preview during deliberate flick](lite-target-preview.png)

The final built-game run covered desktop and touch using external-art HTML, and standalone HTML opened with `file://`: 33 gameplay assertions passed. Source-page desktop and touch flows were also exercised during development. Selection did not play a card; Information/Play committed it; End Turn produced a responsive new hand; alive/dead display matched state; Armoury opened; no uncaught errors were observed. A separate CDP touch sequence, with explicit event timestamps after twenty unchanged render calls, committed exactly one card in each of Lite and Full modes.

The twenty-render probe preserved the player frame, sprite, enemy frame and card identities. Added/removed DOM nodes dropped from 760 in the initial dev baseline to 120. This is a controlled unchanged-state probe, not a frame-rate or crash-reproduction result. Physical iPhone/Safari and longer memory testing remain outstanding.

Standalone HTML: 53,261,533 bytes. External-art HTML: 4,990,660 bytes plus its asset directories. The current dev standalone at the same base was 60,733,964 bytes: this build saves 7,472,431 bytes, approximately 7.5 MB. Assets excluded from shipping remain in the source tree.

See [implementation and validation notes](../../MOBILE-PERFORMANCE.md) and the [component catalog](../../component-catalog.html).

Validation boundary: 37 focused combat/rendering tests passed after the final rebase. The earlier full Node run passed 138 tests. Later full reruns hit Windows temporary-drive exhaustion or were stopped when dev advanced; a complete final-base full-suite result is not claimed. The source-page About browser check also timed out on an empty page in this environment, while built-game flows passed. Repeat those checks after restoring system-drive headroom.
