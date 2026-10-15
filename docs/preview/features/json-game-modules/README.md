# JSON-driven game profile previews

## Capture provenance

Captured 2026-10-15 from the standalone `AshenSpire.html` built as AshenSpire 0.7.1.1538 (source digest `4c1356f8c0`, source commit `b765fb26d`). The same runtime artifact was used for both profiles; profile selection came from the `gameProfile=core` or `gameProfile=current` URL parameter. Chromium ran headlessly through Playwright against the local standalone server at `127.0.0.1:4301`. Each screenshot is a viewport capture, not a full-page crop.

Desktop is 1440×900, wide is 1920×1080, tablet is 820×1180, and mobile is 390×844. Title images use the in-memory saved-run title fixture (`?shot=title`); combat and rest use `?shot=combat` and `?shot=rest`. Fresh menu images were taken from a new browser context after dismissing the startup gate; they have no saved run. All 24 profile/state/viewport pages loaded with zero browser page exceptions.

GitHub Actions built both branch artifacts successfully: [core build run](https://github.com/cehinds/AshenSpire/actions/runs/38701086476) and [current build run](https://github.com/cehinds/AshenSpire/actions/runs/38701086793). The browser could not reach the public Pages host from the capture environment, so these local screenshots verify the artifact, not public URL availability.

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
