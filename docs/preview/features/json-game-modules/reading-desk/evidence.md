# Reading Desk screenshots

Captured on 2026-10-16 in headless Chromium using the repository's `tools/browser.mjs` and `tools/serve.mjs`, serving the unbuilt source at `/deck-reading-desk-preview.html`. These are source-screen captures, not production deployment or packaged-build evidence.

| Image | Viewport | Source / state |
| --- | --- | --- |
| [Before desktop](before-desktop.png) | 1440 × 900 | `593d61962f81ff658ca55607dcb834db9e7d6feb`; original three-column editor; initial 11-card Reaver deck |
| [After desktop](after-desktop.png) | 1440 × 900 | `087880ede`; compact two-column editor; selected Shield Defend; 12-card deck after the save check |
| [After mobile list](after-mobile-list.png) | 390 × 844 | `087880ede`; initial 11-card Reaver deck; All tab |
| [After mobile inspection](after-mobile-inspection.png) | 390 × 844 | `087880ede`; Shield Defend inspection after the save check |
| [Optional animation](after-desktop-animation.png) | 1440 × 900 | `087880ede`; Show animation selected; card face replaced by the 230px animation stage |

The implementation consists of `e4f61e7a2` and `087880ede`. The control strings come from `1b74dae0b`, cherry-picked into the worker branch as `7615fa68c`.

All captures use the fixture's isolated Reaver run, seed 7, default equipment and unordered deck editing. The fixture loads base, UI, kit and responsive type styles. The capture harness additionally loads `illustrated-cards`, `combat-poses`, `alternative-combat`, `combat-layers` and `player-polish`, matching the relevant game styles omitted by the fixture. The source server used the available light artwork pack as its fallback because the high pack was not fetched.

## Checks

- `node --test tests/deck-editor.test.mjs tests/deck-card-animation-preview.test.mjs`: 75 passing tests, including Counter inspection → Defend focus → Strike click updating the face without another inspection action, half-speed playback, one-second loop pause, and preview disposal.
- Chromium at 1440 × 900 and 1366 × 768: every visible collection row's complete effect and combat rules fit in the inspection reading area without scrolling. The face uses the space remaining after the rules, capped at 180px wide. Tags and symbol/keyword explanations remain in the collapsed reference section.
- Chromium at both desktop sizes and 390 × 844: Counter → Defend selection updates the face and rule title immediately; add/remove change the deck; Cancel restores the opening deck exactly; Done saves the edited deck; no horizontal page overflow.
- Optional animation replaces the card face, retains keyboard focus on its toggle, and renders a 230px stage. Browser console errors: none.

On mobile, the longer Dodge Roll and Shield Bash combat explanations require approximately 42px of scrolling, and Guard Counter approximately 3px in the tested run. Their main effect descriptions remain above the fold. These checks do not establish behavior for every card, text-size setting, language, browser or equipment combination.
