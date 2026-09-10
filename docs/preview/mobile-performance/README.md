# Mobile performance review

Build 0.6.0.109, source digest `4e6780f5b8`, based on dev `b893bef7`.

Captured in local headless Edge with Playwright, 390×844 touch and 1440×900 desktop, device scale 1. The gameplay QA uses fast pacing and hold confirmation off; the timestamped flick preview uses the normal fixture settings. These are browser-emulated phone layouts, not physical-device captures.

- [Phone: external-art build](phone-web-combat.png)
- [Desktop combat](desktop-combat.png)
- [Phone: Information and Play from standalone file](phone-offline-inspection.png)
- [Phone: Lite target preview during deliberate flick](lite-target-preview.png)

The final gameplay run covered source desktop and touch, served external-art HTML, and standalone HTML opened with `file://`: 44 checks passed. Selection did not play a card; Information/Play committed it; End Turn produced a responsive new hand; alive/dead display matched state; Armoury opened; no uncaught errors were observed. A separate CDP touch sequence, with explicit event timestamps after twenty unchanged render calls, committed exactly one card in each of Lite and Full modes.

The twenty-render probe preserved the player frame, sprite, enemy frame and card identities. Added/removed DOM nodes dropped from 760 in the initial dev baseline to 120. This is a controlled unchanged-state probe, not a frame-rate or crash-reproduction result. Physical iPhone/Safari and longer memory testing remain outstanding.

Standalone HTML: 52,977,454 bytes. External-art HTML: 4,986,875 bytes plus its asset directories. The initial dev standalone was 60,445,548 bytes; changes arriving during rebase add a few KB, so this is an approximate 7.5 MB reduction. Assets excluded from shipping remain in the source tree.

See [implementation and validation notes](../../MOBILE-PERFORMANCE.md) and the [component catalog](../../component-catalog.html).
