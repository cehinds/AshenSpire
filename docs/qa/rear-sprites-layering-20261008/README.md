# Rear sprites and combat layering continuation

The local implementation is complete on `codex/rear-sprites-layering-20261008` in
`cehinds/AshenSpire`. This is a recoverable feature checkpoint, not a dev merge or
test promotion. Reconcile the overlapping appearance and reaction work before
opening a ready integration PR. The original request and later placement
correction are preserved in [owner-markup.png](owner-markup.png).

## Accepted behavior

Front to back: HUD and footer controls, cards, inspection/intent/target controls,
player artwork, enemy artwork, footer fade, character shadows, floor/near scenery,
structures, sky. The owner's later screenshot explicitly supersedes the original
fade-above-player instruction. The scene still uses its existing paintings; the
layer sorter supports separately authored scenery without splitting a painting.

Enemies recede toward the upper right. The solo rear-facing player sits above the
hand. The footer fade ends lower, behind both characters. Hand changes and taller
selection controls retain the settled sprite geometry. Only melee root motion
translates the rear renderer; it returns to its starting anchor. Fixed drawing
scale is preserved across actions and held stances, while the painted limbs and
weapons naturally change silhouette.

## Repository state and integration boundaries

- Original detached base: `74fbff9a26e4fd6d7f3c6e5d12a928fe133fd138`.
- Feature branch: `codex/rear-sprites-layering-20261008`; remote `origin`,
  `https://github.com/cehinds/AshenSpire.git`.
- Implementation and tested runtime commit: `7da203eb33ee7a1a35cfe9c808272411d708da8f`.
  Its origin branch was verified with `git ls-remote` after the successful push.
  The following evidence/verifier commit preserves that runtime and adds these
  durable reports; use the latest origin branch tip when continuing.
- Latest dev observed before checkpoint: `c47f54d42dd04505b60ac6b478b314788a440ffe`.
- Built runtime: `0.7.1.1151`, source digest `e4095c5de9`.
- Shared handoff source: `codex/session-continuations-20261008` at
  `3178fd1b590a9bfae1589846181f16e54a48af57`.
- No task PR, hosted CI run, dev merge, test promotion, alternative promotion or
  owner/device acceptance is claimed. The worktree's primary checkout and other
  sessions were not modified.

The original regular-versus-alternative delivery question was unanswered. This
checkpoint preserves the current regular-base preview that the owner corrected;
it does not overwrite protected alternative paths. These concurrently open PRs
must be compared again before integration:

| PR | Observed head | Overlap and required care |
| --- | --- | --- |
| [1757](https://github.com/cehinds/AshenSpire/pull/1757) | `6071186d51dcd737f0ebb13a12e3a1f26fd7fc49` | Broader default alternative appearance, `assets-display/alternative`, anchors, renderer selection, asset packaging, combat/coop screens and screenreach. Prefer its canonical display-asset package over maintaining duplicate art systems. Port this checkpoint's owner placement, shared layer order and stability contracts deliberately. |
| [1767](https://github.com/cehinds/AshenSpire/pull/1767) | `dd66519c475b93ef604dd4dd5865c6d565514042` | Reaction and Counter ordering, fx, battlefield/geometry and combat/coop screens. Preserve separate incoming defense and successful Counter-return beats. Do not replace that branch's newer runtime with these older screen files. |
| [1766](https://github.com/cehinds/AshenSpire/pull/1766) | `3d5bea6fe5b979e4873fa09ce53ff02d95df7c24` | Card layout and interaction. Keep its readability and targeting changes. |

## Source and artwork

`src/ui/models/CombatCompositionModel.js` and
`src/ui/components/battlefieldStage.js` own the fixed hand anchor, cached body
geometry and placement. `combatGroundShadows.js` uses `data-shadow-for`, never
`data-eid`, so decorative shadows cannot intercept actor lookup.
`styles/combat-layers.css` owns the common paint order without trapping actors
inside wrapper stacking contexts. `illustratedBackground.js` sorts authored
scenery layers. `styles/combat.css` keeps non-melee body transforms stationary.
Co-op owns the fit cache for the encounter, wires the stage after the hand/footer
mount, and retains loaded image measurements across receipt DOM replacements.
Field dimensions are normalized before formation calculations so CSS zoom float
noise cannot invalidate the fit. The cache resets when leaving combat.

`src/model/alternativeCardAnimation.js`, `alternativeStance.js`,
`src/ui/alternativeCardStage.js`, `animationPace.js`, `assets.js`, `fx.js`, and the
combat/coop screens select rear card actions and retain per-seat held stances.
The speed API uses explicit wrappers: this repository's bundler rejects
`export { name } from './module.js'`. The body canvas owns its melee movement,
so screens must not add a second CSS movement to an `ownsMotion` stage.
Hurt, heavy-hit and stagger feedback on the rear stage uses tint without root
translation, rotation or scale. The real player/sprite wrapper is covered by QA.

All 204 rear WebP files are committed under `assets-alternative/`. Their exact
published source is `origin/alternative/dev` commit
`43221ee66f80055580dfe640418cac37137945f1`; that was also the verified remote tip
at the checkpoint. Catalogs `src/content/alternativeCardAnimations.js` and
`alternativeSelectedStances.js` retain per-file hashes and source references.
The sets cover four base-armour classes, eight actions per class and three held
stances per class. Equipment-specific art combinations and new defeat artwork
are outside this package. `CREDITS.md` records provenance.

`tools/asset-pack.mjs` verifies those hashes and adds the rear images to the common
pack; `tools/bundle.mjs` also includes them in single-file asset maps. Base art
continues to use the published `hd-assets-v14` pin in `art-release.json` and
`art-manifest.json`. Do not commit `.art-cache`, build/dist outputs, browser
profiles, `.codex` logs or the temporary extraction tar.

## Reproduce the verified checks

Use Node 22 and Playwright with Edge available on Windows. Set `NODE_PATH` to an
existing Playwright installation, or install Playwright into a separate D:
tooling directory. No author-machine absolute runtime import is required by the
tracked probes. Set `TEMP` and `TMP` to a D: temporary directory.

```powershell
git fetch origin
git switch codex/rear-sprites-layering-20261008
git pull --ff-only
node tools/fetch-art.mjs --pack light,common
node --test tests/rear-combat-art.test.mjs tests/asset-pack.test.mjs tests/combat-composition.test.mjs tests/combatAnimation.test.mjs tests/combat-sprite-scale.test.mjs tests/combat-overhead-anchor.test.mjs tests/wireframe-scene-layers.test.mjs tests/combat-counter-animation.test.mjs tests/art-restore.test.mjs
node tools/bundle.mjs --light --out build/rear-combat-preview
node tools/verify-external.mjs --dir build/rear-combat-preview
node tools/serve.mjs --port 8338 --no-open --no-lan
```

In a second terminal, with `NODE_PATH`, `TEMP` and `TMP` configured:

```powershell
$env:COMBAT_QA_URL='http://localhost:8338/build/rear-combat-preview/AshenSpire.html'
$env:COMBAT_QA_OUT='.codex/rear-final-package/layers'
node tools/combat-layer-qa.mjs
$env:COMBAT_QA_OUT='.codex/rear-final-package/actions'
node tools/rear-player-qa.mjs
$env:COMBAT_QA_OUT='.codex/rear-final-package/cards-desktop'
node tools/combat-card-stability-qa.mjs
$env:COMBAT_QA_OUT='.codex/rear-final-package/cards-phone'
node tools/combat-card-stability-qa.mjs --phone
```

The package adapter in `tools/rear-qa-runtime.mjs` exposes existing compiled
module exports only in the browser's intercepted HTML response. It does not
change the saved package or substitute source modules. `packaged-combat.png`
also records a separate uninstrumented package boot and card selection.

## Validation and remaining work

- The package build passed, including 680 compiled modules and all literal asset
  references. The first attempt exposed an unsupported re-export; the explicit
  wrappers fixed it and the successful build is the one recorded above.
- All 73 focused unit tests passed. The wider simulation/self-test suite was not
  completed; an earlier broad run was stopped when it entered the long balance
  simulation. This is not full CI acceptance.
- Four classes, 32 actions and 12 held stances passed the compiled renderer
  checks. Every non-melee sample stays at its anchor; melee advances and returns;
  all frame drawing sizes remain fixed.
- The final compiled package also passed all 20 wrapped reaction checks and
  [311 package integrity checks](package-integrity.txt). The package verifier
  now validates the same hash-checked rear catalog as the pack builder.
- Independent review identified generic hurt/stagger CSS displacement and co-op
  fit loss across receipt remounts. Both are fixed. Source browser QA passed 20
  wrapped reaction checks; the co-op regression replaces the actual field,
  removes a card and enlarges intent controls, with zero actor geometry drift.
  A final independent code/evidence review found no remaining correctness issue
  in the fit persistence or combined catalog validation. It confirmed the known
  solo audio 404 limitation below.
- Source layout checks passed at 1440x900, 650x766, 390x844, 844x390 and co-op
  1440x900. Real three-card source playthroughs passed on desktop and phone;
  maximum resting geometry drift was 0 px and 0.109375 px respectively.
- Uninstrumented packaged boot loaded rear artwork and accepted card selection
  without page exceptions. It still requested the pre-existing missing
  `assets/sfx/holdTick.ogg`. Do not claim a request-clean package.
- Final compiled layout checks passed all five cases, including zero co-op
  remount geometry drift: [layer report](layer-checks.json). The compiled
  renderer report is [animation-checks.json](animation-checks.json).
- Three accepted card plays passed on [desktop](card-desktop.json) and
  [phone](card-phone.json), with no page exceptions. Maximum resting geometry
  drift was 0 px on desktop and 0.109375 px on phone (browser layout rounding).
  All commands above exited 0. Co-op is a local snapshot stub, not a real
  two-client LAN acceptance test.

The checked captures are [desktop](combat-1440.png), [owner-sized](combat-650.png),
[phone](combat-390.png), [short landscape](combat-844.png), and
[co-op](coop-1440.png). Real-play captures are [desktop](card-desktop.png) and
[phone](card-phone.png). `packaged-combat.png` is the earlier uninstrumented build
1150 capture; the other captures and compiled reports are build 1151.

Before a ready PR, reconcile the three overlaps above, run current-head fast
gates and a fresh package capture, and independently review the reconciled diff.
Use the current CHANGELOG/CONTRIBUTING tooling to regenerate the receipt and
metadata; this checkpoint does not contain a new integration receipt. Coordinate
one dev-to-test promotion with the integration chat after the eligible PRs land.
Leave release/main/tags to the owner. Record independent review, hosted CI, merge,
promotion and owner acceptance separately from this pushed checkpoint.
