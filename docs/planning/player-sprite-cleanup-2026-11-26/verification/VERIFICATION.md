# Verification and capture record — before only

**Primary stage captures were inspected, and 68 focused assertions passed.**
Full-game combat/HUD acceptance, device/motion coverage, and after-images remain
open. No gameplay, art, registration metadata, or existing tests were changed.

Source: `49eca254d795d06266aa23941cb2b31fe77b27bf` (2026-11-26,
America/Anchorage). Art: `cehinds/AI-Art`, `ashenspire-hd-assets-v30`.

## Primary runtime evidence

These are **synthetic posed snapshots of the unchanged production
`createAlternativeCardStage` renderer**. They use pinned high/common pack bytes
through the ordinary game server; they are not deployed-game screenshots or
combat playthroughs.

All **12 sampled image loads** returned HTTP 200 and matched both the resolved
cache bytes and retained v30 hashes. Each URL was read over HTTP and its SHA-256
compared with the file resolved by `artPath`.

Before producing outputs, the capture script checks **23 owning-source hashes**
(LF-normalized) and **330 retained raster rows**. Changed source, pins, or cache
bytes fail instead of being relabeled as the old baseline.

| Primary case | Desktop | Phone viewport, full-page strip |
| --- | --- | --- |
| Reaver selected greatsword pilot: ready, held Sweep, Sweep contact | [1280×800](runtime-reaver-1280-before.png) | [390×844](runtime-reaver-390-before.png) |
| Starseer: ready, taking a hit, returned to ready | [1280×800](runtime-starseer-1280-before.png) | [390×844](runtime-starseer-390-before.png) |

All panels have the same stage placement and **0.52 diagnostic zoom** to include
the full action reach. Images are not independently fitted to their cells.
This zoom is a harness presentation choice, not a change to runtime sizing or a
measurement of battlefield/player scale. Green rulers identify the shared stage
ground, not a claim that all source poses have identical supporting-foot contact.
Canvas draw values shown on the images are unzoomed production canvas units.

For deterministic timing, the harness substitutes `performance.now`, queues RAF
callbacks, and invokes production stage methods. Each sampled stage's RAF queue
is frozen before the next stage advances, so the return sample cannot advance
the earlier hit sample. Production paint code and image pixels are unchanged.

| Sample | Deterministic timing |
| --- | --- |
| Reaver Sweep contact | `seek('sweep', 270, 600)` |
| Starseer hit | 100 ms after `play('hit', 600)` |
| Starseer return | Advance 650 ms |

These timings are diagnostic choices, not the ordinary game pace.

The four final PNGs were inspected. Starseer's middle panel visibly shows the
pointed-hat HURT character, while ready/return show the hooded staff character.
Reaver's held and contact panels are distinct selected-pilot paintings, with
larger contact anatomy visible. Runtime receipts confirm 774.6782609 versus 1024
canvas-pixel draw heights for the same 1024-raster family; this is evidence of
different scale policies, **not proof that every anatomical dimension differs
by exactly that ratio**. Source calibration and perspective still need review.

The machine-readable [runtime capture record](runtime-capture-record.json)
contains source paths, source-image/cache hashes, raster sizes, draw placement,
pose/stance/action state, viewport, effects/motion settings, browser version,
capture time, PNG sizes and PNG hashes. There are no final after-images because
implementation has not started.

### Reproduction

1. Check out the recorded source baseline and ensure v30 high/common packs are
   available through the standard `.art-cache` resolver. In this session only,
   the new worktree's ignored `.art-cache` junction points to the existing
   `C:\repos\AshenSpire\.art-cache`; no cached files were modified.
2. Set `PLAYWRIGHT_MODULE` to an already installed Playwright module and optionally
   `BROWSER_CHANNEL` (default `msedge`). This session used the desktop's bundled
   Playwright and Edge `158.0.4370.33`; no dependencies were installed.
3. Run `node docs/planning/player-sprite-cleanup-2026-11-26/verification/capture-runtime.mjs`.
   Set `CAPTURE_FULL_GAME=0` to skip the separately attempted full-game capture.
   The script starts/stops its own loopback server on port 8338.

## Published baseline is a separate observation

Observed 2026-11-26 21:10 Anchorage / 2026-11-27 06:10 UTC. Live HTTP reads,
response hashes, headers, and exact build-marker excerpts are in
[published-baseline.json](published-baseline.json), reproducible with
[published-baseline.mjs](published-baseline.mjs).

| Channel | Published version | SOURCE digest | Embedded edition | HTTP |
| --- | --- | --- | --- | --- |
| [Test](https://cehinds.github.io/AshenSpire/test/latest/) | 0.7.5.134 | `4fc712b163` | high | 200 |
| [Dev](https://cehinds.github.io/AshenSpire/dev/latest/) | 0.7.5.141 | `815d2ca479` | light | 200 |

`SOURCE` is a content digest, not a Git SHA. The owning game's Git commit and
art-release tag were not exposed by these HTML build markers, so neither is
inferred from unrelated art-catalog `sourceCommit` fields. The local v30 baseline
and its source SHA are verified independently. Published badges/HTML can lag live
Git branch heads; these captures must not be represented as exact published
Test/Dev captures or proof of the owner's personal saved settings.

## Existing focused checks

Run from the planning worktree against unchanged baseline code on 2026-11-26.

| Command | Result | What it establishes |
| --- | --- | --- |
| `node --test tests/combat-body-model.test.mjs tests/pose-invariant-body-size.test.mjs tests/player-hurt-registration-paths.test.mjs tests/combat-body-mutation.test.mjs tests/sprite-frame-hold.test.mjs` | **21 passed, 0 failed** | Current helper behavior, source ownership, mutation tracking, pacing; does not establish visual correctness. |
| `node --test tests/combat-sprite-scale.test.mjs tests/target-body-hud-alignment.test.mjs tests/selected-weapon-sequences.test.mjs tests/selected-weapon-stances.test.mjs tests/alternative-card-animation.test.mjs tests/card-animation-parity.test.mjs` | **47 passed, 0 failed** | Current frame availability, selected-profile/parity, HUD model, legacy fitting, timing and manifest contracts; does not resolve the observed design/scale defects. |

Total **68 focused assertions passed**. No full suite or build-readiness claim is
made for this docs-only planning delivery.

## Test changes to plan, not perform here

| Existing contract | Disposition for cleanup |
| --- | --- |
| `combat-body-model.test.mjs`: “all four class held stances share their own unchanged ready body height” | Replace the player contract with calibrated physical-scale/registration assertions. The current test explicitly enforces the behavior the owner objects to. |
| `combat-body-model.test.mjs`: weapon alpha excluded from semantic body measurement | Preserve the intent; alpha/weapon extents must not determine anatomy. Update helper-specific expectations only with the approved player calibration contract. |
| `pose-invariant-body-size.test.mjs`: enemy normalization and generic resize helper math | Mostly enemy/shared policy. Do not blanket rewrite to change enemies; isolate player policy or explicitly prove shared-consumer effects first. |
| `alternative-card-animation.test.mjs`: registered HURT art exists in both tiers | Preserve existence/hash checks, add canonical identity reference/evidence. Availability is not identity continuity. |
| `player-hurt-registration-paths.test.mjs` | Preserve source ownership/cache-rejection checks. This is deliberately not image decoding or geometry coverage. |
| Selected-weapon/parity/timing tests | Preserve selection, choreography, impact/hold timing and profile parity. Add a pilot check that held/action source calibration is applied consistently. |
| `target-body-hud-alignment` and mutation tracking | Preserve separate stable HUD/target references. Add real-browser no-regression checks for crouches, jumps, hit replacement and source-tiers. |

Regression acceptance should include a planted copy of the previous player
normalization behavior turning the relevant new check red. Do not substitute
an exact numerical implementation mirror for visual anatomy acceptance.

## Coverage and limitations

| Area | Baseline status | Future acceptance requirement |
| --- | --- | --- |
| Reaver selected-pilot ready/held Sweep/contact | Captured and inspected at desktop/phone viewports | Full sequence, final after evidence, corrected calibration |
| Starseer ordinary-motion hit/return | Captured and inspected; distinct HURT identity confirmed | Corrected identity, interruption/active-action checks |
| Source art for all four classes | Worker A/B inventories and reference sheets | Reachable variant visual review and any source corrections |
| Full-game combat/HUD context | Attempted developer `shot=combat` capture; stage-readiness selector timed out after 15 s | Capture actual game/HUD at mobile/desktop; investigate fixture/selector before interpreting the timeout |
| Normal/reduced motion | Normal-motion diagnostic stages captured | Reduced-motion/Instant/fallback differences remain unchecked |
| Effects/high/light behavior | Effects off, high/common resolved bytes recorded | Effects on and light-tier source behavior remain unchecked |
| Actual combat damage event | Stage's production hit API invoked synthetically | Engine receipt → hit reaction integration and real interaction evidence |
| Owner's published target/settings | Public Dev/Test metadata observed; exact owner session unknown | Confirm target build/settings if implementation differs |

The full-game timeout is a capture limitation, not a proven game failure. No
gameplay test was changed to work around it. Successful stage snapshots
establish the recorded selection/draw path; battlefield fit, HUD clearance,
targeting, responsive game layout, and playthrough acceptance remain unchecked.
