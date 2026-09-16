# Combat formation verification

The combat renderer reserves 10/45/30/15 viewport bands. Cards preserve a 5:7 face and overlap without independent width/height compression. Both turn ribbons share one overlay position; enemy playback keeps the hand visible and inert.

Run a local preview with `node tools/serve.mjs --port 8212 --no-open`. With Playwright installed and Edge available, set `COMBAT_QA_URL` to the served source or standalone build, then run:

- `node tools/combat-formation-qa.mjs`: 36 phase/geometry checks and 24 screenshots, four resolutions, three encounter fixtures. Checks card dimensions and positions, ground anchors, aligned meters, locked hand, viewport allocation and page errors.
- `node tools/combat-formation-extra-qa.cjs`: six-enemy nameplate reachability, defeated-slot stability, co-op input lock and atlas Fit/You controls. Run after the main capture to create the output directory.
- `node tools/combat-ground-qa.mjs`: all 20 paintings at four resolutions, two real enemy turns and a reduced-motion resize: 83 checks and 26 captures.
- `node --test tests/combat-foundations.test.mjs tests/combat-formation.test.mjs tests/environment-art.test.mjs tests/card-removal-flick.test.mjs`: 25 passing tests.

The main renderer checks exercise real solo End Turn input and playback. Co-op uses authoritative snapshot fixtures through the actual client renderer; live LAN synchronization and full victory playthroughs are outside these captures. The focused atlas control test supplements the existing World Journey service/save checks.

Screenshots: `docs/preview/combat-formation/index.html` and `docs/preview/combat-ground/index.html`.
