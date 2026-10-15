# JSON-driven game profile previews

## Capture provenance

Captured 2026-10-15 from the standalone `AshenSpire.html` built as AshenSpire 0.7.1.1538 (source digest `4c1356f8c0`, source commit `b765fb26d`). The same runtime artifact was used for both profiles; profile selection came from the `gameProfile=core` or `gameProfile=current` URL parameter. Chromium ran headlessly through Playwright against the local standalone server at `127.0.0.1:4301`. Each screenshot is a viewport capture, not a full-page crop.

Desktop is 1440×900, wide is 1920×1080, tablet is 820×1180, and mobile is 390×844. Title images use the in-memory saved-run title fixture (`?shot=title`); combat and rest use `?shot=combat` and `?shot=rest`. Fresh menu images were taken from a new browser context after dismissing the startup gate; they have no saved run. All 24 profile/state/viewport pages loaded with zero browser page exceptions.

GitHub Actions built both branch artifacts successfully: [core build run](https://github.com/cehinds/AshenSpire/actions/runs/38701086476) and [current build run](https://github.com/cehinds/AshenSpire/actions/runs/38701086793). The browser could not reach the public Pages host from the capture environment, so these local screenshots verify the artifact, not public URL availability.

## Final core flow captures

The updated core browser suite runs against a locally built standalone artifact from the same source as successful CI run [38757871534](https://github.com/cehinds/AshenSpire/actions/runs/38757871534), whose downloadable artifact is [11985005463](https://github.com/cehinds/AshenSpire/actions/runs/38757871534/artifacts/11985005463). The CI download itself was not used for these captures. Fresh class and review captures use source `4f27e2913`; route and shop captures use source `71b140f1f`. Each is a viewport capture. Class, review, map and shop were captured at desktop 1440×900, wide 1920×1080, tablet 1024×768 and mobile 390×844.

| Viewport | Class | Review | Map | Shop |
| --- | --- | --- | --- | --- |
| Desktop | [Screenshot](final-core/desktop-class.png) | [Screenshot](final-core/desktop-review.png) | [Screenshot](final-core/desktop-map.png) | [Screenshot](final-core/desktop-shop.png) |
| Wide | [Screenshot](final-core/wide-class.png) | [Screenshot](final-core/wide-review.png) | [Screenshot](final-core/wide-map.png) | [Screenshot](final-core/wide-shop.png) |
| Tablet | [Screenshot](final-core/tablet-class.png) | [Screenshot](final-core/tablet-review.png) | [Screenshot](final-core/tablet-map.png) | [Screenshot](final-core/tablet-shop.png) |
| Mobile | [Screenshot](final-core/mobile-class.png) | [Screenshot](final-core/mobile-review.png) | [Screenshot](final-core/mobile-map.png) | [Screenshot](final-core/mobile-shop.png) |

The map fits all four viewports. The local server did not provide external detail tiles, so these captures show the embedded low-resolution terrain fallback and the map artwork appears soft. The opening gate sequence is [unlit](final-core/opening-unlit.png), [lit](final-core/opening-lit.png) and [door/menu](final-core/opening-door.png). The exact Pages `srcdoc` sandbox was exercised from the artifact: its origin was opaque, local storage was denied, the gate opened to the title actions, and Exit displayed the farewell screen. Pages deployment was still pending at capture time.

## Product core

Fresh menu: [core profile, no save](core/fresh-menu.png). Saved-run menu: [core profile, in-memory slot fixture](core/desktop-title.png).

| Viewport | Saved title | Combat | Rest |
| --- | --- | --- | --- |
| Desktop | [Screenshot](core/desktop-title.png) | [Screenshot](core/desktop-combat.png) | [Screenshot](core/desktop-rest.png) |
| Wide | [Screenshot](core/wide-title.png) | [Screenshot](core/wide-combat.png) | [Screenshot](core/wide-rest.png) |
| Tablet | [Screenshot](core/tablet-title.png) | [Screenshot](core/tablet-combat.png) | [Screenshot](core/tablet-rest.png) |
| Mobile | [Screenshot](core/mobile-title.png) | [Screenshot](core/mobile-combat.png) | [Screenshot](core/mobile-rest.png) |

## Current game

Fresh menu: [current profile, no save](current/fresh-menu.png). Saved-run menu: [current profile, in-memory slot fixture](current/desktop-title.png).

| Viewport | Saved title | Combat | Rest |
| --- | --- | --- | --- |
| Desktop | [Screenshot](current/desktop-title.png) | [Screenshot](current/desktop-combat.png) | [Screenshot](current/desktop-rest.png) |
| Wide | [Screenshot](current/wide-title.png) | [Screenshot](current/wide-combat.png) | [Screenshot](current/wide-rest.png) |
| Tablet | [Screenshot](current/tablet-title.png) | [Screenshot](current/tablet-combat.png) | [Screenshot](current/tablet-rest.png) |
| Mobile | [Screenshot](current/mobile-title.png) | [Screenshot](current/mobile-combat.png) | [Screenshot](current/mobile-rest.png) |
