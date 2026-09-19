# UI Studio screenshots

Taken by headless Chromium against this checkout at a 1500×900 window, one per
mode and device, for the pull request's screenshot line. Regenerate with
`node ui-studio/tests/browser.mjs` (`UI_STUDIO_EVIDENCE=<dir>`) or the same
Playwright driver at more sizes; the numbers in the images are the config
files' as of the commit that took them.

| File | What it shows |
| --- | --- |
| `01-combat-desk.png` | W4a combat at 1280×800: bands, floor, hand, the footer raised to the W4 minimum |
| `02-combat-phone.png` | the same at iPhone 14 390×844 (narrow, zoom 0.9) |
| `03-combat-phone-landscape-rails.png` | 844×390 (short-wide, zoom 0.62): the footer folds into rails beside the hand |
| `04-dialogue-desk-selection.png` | W4c dialogue with the player portrait selected in the inspector |
| `05-shop-ipad.png` | W1 shop at iPad mini landscape: side rail, offers and detail columns |
| `06-values-panel.png` | every value of the file, with units and variable pickers |
| `07-compare.png` | the wireframe at every enabled device and orientation |
| `08-sketch-phone-override.png` | the example sketch with a box selected, grips and align tools |
| `09-settings.png` | grid, snapping, devices, breakpoints and the game-layout numbers |
| `10-live-game-phone.png` | the real game in the frame at the device size |
