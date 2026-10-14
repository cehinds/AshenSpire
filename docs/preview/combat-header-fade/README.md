# Combat header and skyline capture

Captured on 2026-10-08 in real Microsoft Edge through Playwright, against the source preview at `http://localhost:8642/index.html?shot=combat`. Rendering source commit: `6cea46f907a75b8773fab522fd95e2c8e6888b51`, reconciled with dev `8bf135f3b372f894d82a97e97ed7a6356c24923c`.

This is a posed combat preview, using the existing screenshot state and the canonical HM-ENV-03 painting selected through `combatBackdropHtml`. It is not a completed playthrough or a release capture.

- `phone.png`: 390 × 844.
- `desktop.png`: 1440 × 1000.
- `checks.json`: phone, desktop and 844 × 390 landscape measurements and request/console health.

Each viewport verified scenery above the header, full opacity through the measured Vitality row, the fade ending where the turn ribbon begins, no horizontal overflow, and the header menu opening and closing with Escape. No JavaScript exception occurred. The source preview reported three existing missing sound requests (`nodeTravel.ogg`, `cardDraw.ogg`, `turnStinger.ogg`); these are recorded rather than hidden. The separately exercised light standalone build resolved its assets and reported no console or JavaScript errors.

The shared surfaces are documented in [the component catalog](../../component-catalog.html).
