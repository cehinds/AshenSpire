# Settings and view preset update

Captured 2026-10-15 UTC with Chromium at host sizes 1440×900, 1920×1080, 1024×768, and 390×844. These fresh images replace no historical evidence; earlier galleries remain labeled as historical in the root README.

The final capture pass used the locally served standalone `AshenSpire.html` built from source `90c21acf0`, displaying build **0.7.1.1534**, source digest **200a7df16c**. Artifact SHA-256: `18ad55a340d0eca952243c8b5987daf8bb6d9cab57a210d1657d30625f1555ff`. Local artifact evidence does not establish a published Pages deployment. Current artifact and publication links are maintained in the root README feature block.

| Host | Title menu | Display / View mode | Game rules |
| --- | --- | --- | --- |
| Desktop · 1440×900 | [Title](desktop-title.png) | [Display](desktop.png) | [Rules](desktop-rules.png) |
| Wide · 1920×1080 | [Title](wide-title.png) | [Display](wide.png) | [Rules](wide-rules.png) |
| Tablet · 1024×768 | [Title](tablet-title.png) | [Display](tablet.png) | [Rules](tablet-rules.png) |
| Mobile · 390×844 | [Title](mobile-title.png) | [Display](mobile.png) | [Rules](mobile-rules.png) |

[Mobile preset inside a desktop window](desktop-mobile-preset.png) shows the same document fitted and centered, with the selected Mobile view visible in Settings.

Browser checks passed against integrated source and standalone build 0.7.1.1534:

- Both core and current configured fights retained the identical live combat object, run HP, deck, combat turn, player HP, and phase through Desktop, Mobile, Widescreen, Tablet, and Auto choices made in Settings.
- Presets reported the authored logical dimensions and fitted within the host. Settings stayed reachable, including Desktop → Auto recovery on a 390×844 host.
- Real pointer input exercised target selection, End Turn tooltips, configured target hold inspection, current-game name inspection, and scaled map dragging. Map displacement matched the measured rendered scale; releasing removed the grabbing state.
- Title actions had equal widths. Display and Game rules were reachable at all four host sizes, and the Game rules configuration selector and JSON input were present.
- The UI size readout matched the actual computed UI zoom after each preset change, including asynchronous persistence.
- No page errors were emitted.

The final full interaction and capture pass used the exact artifact identified above, including the native-query fallback, Reset All integration, and asynchronous choice/readout fix. The suite is `tests/view-presets.browser.mjs`; `VIEW_PRESETS_BASE` selects a running server and `VIEW_PRESETS_ENTRY=AshenSpire.html` selects the standalone artifact. `VIEW_PRESETS_CAPTURE_ONLY=1` refreshes the gallery without repeating combat and map interactions.
