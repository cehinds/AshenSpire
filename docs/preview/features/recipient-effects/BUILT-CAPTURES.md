# Built game: pinned-art debug fallback captures

These are screenshots of the actual self-contained standalone game, with pinned **v26** art and **no staged recipient sprites injected**. The natural seeded Ironbreaker card and a living enemy were clicked in the real game. A real damage receipt produced the static Smash/target debug marker. The browser clock was paused only after contact appeared to capture that short effect; this is a single-action smoke test, not a campaign playthrough.

- Artifact: `build/download/AshenSpire.html`.
- Build: **0.7.4.166**, source digest **43334ca39d**.
- Artifact SHA-256: `5bb8d73981a11cd3fe3bf837c9478d18e2e6545ab7588cdb4ac0c7ff420b54d5`.
- Captured: `2026-11-18T20:05:17.371Z`.
- Source at capture: `33774f646ee9a7a9800d41e4f440c3865e8d5720` plus the reviewed, then-uncommitted API naming/atlas metadata and fallback image-cap changes. The artifact digest identifies the built content; the commit alone does not.
- Build command: `ASHEN_ART_SOURCE=cache node tools/launch.mjs --build-only` (PowerShell environment assignment used locally).
- Capture command: `BUILT_HTML=build/download/AshenSpire.html node scratch/recipient-effects/built-qa/capture-built.mjs` (PowerShell environment assignment).

| Screenshot | Viewport | Result |
| --- | --- | --- |
| [built-desktop.png](built-desktop.png) | 1280 x 800 | Real contact; static frame 1; image fits viewport |
| [built-phone.png](built-phone.png) | 390 x 844 | Real contact; static frame 1; image fits viewport |
| [built-wide.png](built-wide.png) | 1920 x 1080 | Real contact; static frame 1; image fits viewport |
| [built-tablet.png](built-tablet.png) | 1024 x 768 | Real contact; static frame 1; image fits viewport |

All four images were visually inspected. The fallback image uses the existing 120 CSS-pixel setting inside the unchanged effect host; UI zoom makes the phone image 108 physical pixels, ending at x=375.19 within its 390-pixel viewport. No page errors were observed. The renderer regression suite passed 17 tests before the mechanical API rename; the worker subsequently passed 68 focused tests including this test.

Local detailed evidence: `scratch/recipient-effects/built-qa/43334ca39d/report.json`. The earlier oversized-marker artifact (0.7.4.167 / 309dd96ea2) and captures remain preserved separately. Its higher ordinal reflects a previous temporary local build stamp; it is not the artifact shown here.

The adjacent `staged-*` images show the separately labelled optional artwork review. These `built-*` images demonstrate the pinned-pack fallback. A public playable URL must be verified separately before being claimed.
