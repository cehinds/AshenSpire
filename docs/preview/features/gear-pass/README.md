# Gear mechanics capture record

These are posed source-tree screenshots of the real character-creation and
combat renderers, taken by the sandbox acceptance runner. They are not a
completed playthrough or evidence that a hosted Gear build has shipped.

- Full-matrix source baseline: `794cc54148189b6642ea1fa3357b5dae34484704`,
  runtime `sha256:8f1b1cf21f5758b4e1b1b916c9227df0747b56490217395410b94e6cffa259cc`.
- Final source: `986003f5e3e512f177f28521c7a07a6ace8cc9ba`,
  runtime `sha256:50362dd44639557361f67ebe789bf6109bb8459242b0d48d48535a00aabf95e9`.
  The creation captures were refreshed and rechecked on
  `805ab7502a0cd59e50e59367001dcae9f0e9de78`; the final follow-up only regenerates
  Diamond Skin labels on two cards absent from these fixtures. The inspector
  captures are from the full matrix on the preceding source baseline.
- Capture date: 2026-11-19 UTC (2026-11-18 in Anchorage).
- Inherited source-tree build box: **0.7.4.198**, digest `26e048277a`.
  That is the inherited Dev stamp, not a Gear standalone-build publication.
- Art: pinned `ashenspire-hd-assets-v29`, using its verified local packs.
- Before tree: `origin/dev`, `66e473a77c74da54bd8701fd5a2614a0e7484985`.
- Acceptance source: [acceptance-gear-pass.json](../../../qa/acceptance-gear-pass.json).
- Reproduce: `npm run qa:sandbox -- docs/qa/acceptance-gear-pass.json --base origin/dev`.
- Full-matrix result: **80 passed, 0 failed**, three scenes at four viewports,
  report generated at `2026-11-19T06:22:06.342Z`.
- Final-source creation recheck: **32 passed, 0 failed**, the affected creation
  scene at all four viewports, with fresh captures; report generated at
  `2026-11-19T06:32:30.437Z` on `805ab7502a0cd59e50e59367001dcae9f0e9de78`.
- Separate resource audit: all 12 scenes had zero failed HTTP/network requests,
  zero page errors and zero visible broken images. Combat retains one hidden,
  empty-source image element; it is not a requested or missing art asset.
- Expected hosted preview route, pending CI publication and verification:
  [GearPassMechanics](https://cehinds.github.io/AshenSpire/branches/chore/GearPassMechanics/latest/).

The capture harness advances creation to Review, opens the actual player's
inspector by holding the fighter, and scrolls the inspector's own details pane.
The staff scene equips Ash Staff through the existing `shotKit` hook. It uses
Reaver because the staff's turn-start grant is class-independent and a fresh
profile need not have unlocked Starseer.

The subsequent source changes gate the new equipment vocabulary, default-item
mapping and themed reward RNG for older profiles without `typeEffectsVersion: 1`.
These fixtures use version 1, so those gates preserve their existing paths.
The other visible change renames the Block-retaining `stoneskin` status to
Diamond Skin and leaves Pierce-cancelling `stoneHide` as Stone Skin; none of
these fixtures carries either status. The source diff was checked for those
conditions, and the affected creation scene was rerun on the final commit.
The 80-check matrix is not presented as a fresh full run on the later commit.

Assertions verify the starting Wayfarer Plate and Greatsword each show six item
Poise, the default Reaver has 17 live Poise and Thorns 1, and Ash Staff grants
Ward 1 with the five-Poise explanation. The staff fixture's total is 16 Poise
(11 equipment/attribute Poise plus 5 from Ward). No console or missing-resource
errors are ignored; only the browser's blocked-vibration notice is excluded.

| Scene | Desktop 1280×800 | Phone 390×844 | Wide 1920×1080 | Tablet 1024×768 |
| --- | --- | --- | --- | --- |
| Starting equipment | [Capture](desktop-character-sheet-gear-after.png) | [Capture](phone-character-sheet-gear-after.png) | [Capture](wide-character-sheet-gear-after.png) | [Capture](tablet-character-sheet-gear-after.png) |
| Plate Thorns and live Poise | [Capture](desktop-combat-hand-and-inspector-after.png) | [Capture](phone-combat-hand-and-inspector-after.png) | [Capture](wide-combat-hand-and-inspector-after.png) | [Capture](tablet-combat-hand-and-inspector-after.png) |
| Staff's turn-start Ward | [Capture](desktop-staff-starts-with-ward-after.png) | [Capture](phone-staff-starts-with-ward-after.png) | [Capture](wide-staff-starts-with-ward-after.png) | [Capture](tablet-staff-starts-with-ward-after.png) |

All twelve after captures were visually inspected for loaded art, readable
status text, clear controls and incidental tooltip obstruction. Before captures,
the full sandbox report, the resource audit and the original replaced four PNGs
are retained outside the repository in the task's QA artifact directory; bulk
evidence JSON is not committed.
