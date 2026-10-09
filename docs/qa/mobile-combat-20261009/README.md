# Compact combat touch controls

PR [#1776](https://github.com/cehinds/AshenSpire/pull/1776), 2026-10-09. Final receipt: **0.7.1.1192**, source digest **2ac6695545**. Build1191 (`f6be6a01a9`) has identical runtime behavior;1192 restores the already-merged1775 receipt and records this follow-up separately.

Player health accepts self-cast cards. Selection reveals name, level, Poise and Ward on a dark panel beside the player; delayed Inspect stays above the painted character. Enemy intent buttons select/play legal targeted cards; name/HP plates remain below their bodies. Footer labels fit one line each. Resting cards leave a right-aligned toolbar above the hand. Tap Log to toggle, or drag vertically to snap among three sizes without inner buttons. Selected card Inspect stays inside the face and clear of the toolbar.

## Verification

- Real touch at288x513,320x568,390x844 in source and packaged1191: a starting self-card is consumed through playerHP; natural turns draw attacks consumed through intent and target buttons. Reaction, turn confirmation, inspection doors and logs respond. No injected combat state or page errors.
- Native Log touch at288/320/390/844: closed/open drags, three distinct stops, cancellation, subsequent taps, and keyboard resizing with retained focus.
- Geometry: playerHUD clears enemies and tools; resource text does not overlap; enemy plates remain below feet; player Inspect follows visible alpha bounds; card Inspect has an exposed center clear of toolbar.
- Independent review:12 layout/card-play cases at390/650/844/1440, plus real direct/portal card Inspect, log and reaction taps. The discovered Inspect/log interception was fixed and rechecked. No remaining P1/P2 findings.
-39 focused layout/model assertions passed. Full build refreshed pack, download and all four aliases. Exact1192 identity/receipt/shipped checks accompany delivery.

## Reproduce

Set `NODE_PATH` to installed Playwright modules. Run `tools/combat-mobile-touch-qa.mjs` or `tools/combat-log-touch-qa.mjs`, with `COMBAT_QA_URL` pointing at the source or package, and `COMBAT_QA_OUT` naming an output directory. Optional `QA_WIDTH` selects a supported viewport. `tools/combat-attached-details-qa.mjs` covers varied enemy counts and keyboard play with explicit crowd fixtures.

These captures are local QA evidence. Hosted CI and dev/test promotion are reported separately; owner/device acceptance is not inferred.
