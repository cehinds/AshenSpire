# Mobile performance baseline

Measured 2026-10-29 on `worker/MobilePerf/measure` (dev `3274760120`) with
`node tools/perf-probe.mjs --runs 3`. **Measure only: nothing here is fixed.**
This is the profile of docs/FINISH.md §7 ("60 fps on a low-end phone profile",
RELEASE-CHECKLIST G20): Chromium, 390x844 at 3x, touch, **4x CPU throttle**,
fixed seed `PERF1`, `?shot=` doors (Core profile, memory storage), real touch
input. Each number is the median of 3 runs; run-to-run spread was small (below).
Raw per-run JSON stays out of the tree (the probe's `--out`, default `$TMPDIR/ashen-perf`).

Owner's ask (2026-10-29): "Needs to be 2x smoother."

## Read this first

- **FINISH §7's gate ("median frame time <= 16.7 ms") cannot fail.** A running rAF
  loop floors the median at 16.7 ms in every scenario, including the worst one.
  It reads green while the combat turn drops a frame in five. Gate on p95 and
  on the share of frames over 33 ms instead (proposed targets at the end).
  The §7 line stays `[ ]`.
- **The combat turn is the problem.** The main thread is busy 85% of the window
  (10.8 s of 12.7 s), 43 long tasks block it for 5.7 s, and p95 frame time is
  217 ms. The map is already smooth. Hand interaction and transitions sit between.
- **70% of style plus layout time is forced** (a JS read right after a write),
  not scheduled. That is the cheapest large win.

## Scenarios

1. **combat**: tap 2 cards (the opening hand's 3 SP buys two), hold End Turn, the enemy acts, turn 2 starts.
2. **map**: 9 drag-pans over the act map (`?shot=map&shotWalk=3`), one zoom in, reset.
3. **hand**: drag an Attack up toward the field and back, then select a card and open and close card inspect, twice.
4. **transitions**: last hit (enemy left at 1 HP in unmeasured setup), reward screen, hold Continue, act map.

## Metrics (4x throttle, median of 3)

Frame times are rAF deltas in the page. Pass A also records a CDP trace; the CPU
profile is a separate pass (it slows the page, so its frame times are not used).

| scenario | window s | frames | median ms | p95 | p99 | >16.7 ms | >33 ms | long tasks n / total ms / blocking ms | peak animations running / transitions / infinite |
|---|---|---|---|---|---|---|---|---|---|
| combat | 12.7 | 260 | 16.7 | 216.7 | 716.6 | 22.3% | 17.0% | 43 / 7672 / 5672 | 3 / 2 / 0 |
| map | 12.7 | 756 | 16.7 | 16.7 | 16.8 | 0.4% | 0.3% | 1 / 68 / 18 | 0 / 0 / 0 |
| hand | 14.1 | 524 | 16.7 | 50.1 | 233.2 | 20.3% | 9.5% | 42 / 4661 / 2476 | 5 / 3 / 0 |
| transitions | 15.0 | 617 | 16.7 | 33.4 | 200.1 | 7.2% | 4.5% | 25 / 4264 / 3014 | 9 / 9 / 0 |

"blocking" is the part of each long task beyond 50 ms. Spread over the 3 runs
(combat): p95 217/217/233, long-task total 8146/7610/7672 ms, main busy 10.8/10.3/10.8 s.

Main-thread work from the trace (ms over the window; `n` is the event count).
"sync" is a style recalc or layout that ran inside JS (a forced one).

| scenario | style (n) | layout (n) | sync layout (n) | sync style (n) | pre-paint | paint | layerize | commit | script | GC | main busy | raster, workers | image decode, workers |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| combat | 1319 (285) | 1268 (177) | 777 (128) | 1033 (186) | 195 | 367 | 388 | 501 | 7187 | 35 | 10758 | 1032 | 151 |
| map | 333 (188) | 39 (18) | 26 (10) | 119 (19) | 188 | 83 | 26 | 323 | 1482 | 0 | 3643 | 606 | 2 |
| hand | 1548 (387) | 795 (245) | 612 (155) | 1105 (201) | 405 | 823 | 764 | 803 | 5082 | 57 | 10084 | 913 | 56 |
| transitions | 866 (285) | 915 (167) | 372 (76) | 474 (116) | 236 | 370 | 468 | 660 | 4261 | 12 | 8610 | 846 | 299 |

Displayed-frame gap (compositor): combat median 16.7 / p95 130 ms, hand 18.4 / 280,
transitions 16.8 / 37, map 49.7 / 270 (the map only draws when something changes,
so its gap is idle time, not jank).

DOM and paint census at the end of each window:

| scenario | DOM nodes (start / end) | canvases | imgs | elements with filter | box-shadow | text-shadow | backdrop-filter, blend, will-change |
|---|---|---|---|---|---|---|---|
| combat | 961 / 955 | 1 | 65 | 25 | 20 | 137 | 0 |
| map | 639 / 639 | 0 | 4 | 9 | 4 | 32 | 0 |
| hand | 961 / 974 | 1 | 66 | 27 | 26 | 142 | 0 |
| transitions | 961 / 618 | 0 | 4 | 5 | 4 | 32 | 0 |

No infinite animations run in any scenario, so nothing burns frames at rest.
Peak running animations: 3 in combat, 9 in transitions.

For scale, the same combat turn **with no throttle** (1 run): main busy 2.8 s of 6.8 s,
p95 33 ms, 12 long tasks (1.1 s). The throttle multiplies the main-thread cost
about 4x, as expected: the work is CPU-bound, not waiting on anything.

## Top 10 hot spots

Costs are per window at 4x throttle (combat turn unless noted), from the CPU
profile and the trace; the unthrottled cost is about a quarter of each. "Forced" means a layout or style recalc that
the browser had to run synchronously inside JS because something was read after a write.

| # | where | cost | why |
|---|---|---|---|
| 1 | `src/ui/components/battlefieldStage.js:327` `separateRackedIntents` (called from `centerTargetOverheads`) | 38 forced layouts, 324 ms | It removes a style property on each intent (a write), then calls `getBoundingClientRect` on the field and each intent (reads). Every refit pays a full layout. |
| 2 | `src/ui/components/combatTools.js:219` `measure` | 11 forced layouts, 307 ms (about 28 ms each) | Reads `getBoundingClientRect`/`clientWidth`/`getComputedStyle` of the whole combat screen right after card DOM writes. |
| 3 | `src/ui/frameMeasure.js:31` `measure` | 47 forced layouts, 238 ms | Its rect cache is cleared every microtask, so each read after a write re-lays out. Called from many sites. |
| 4 | engine transaction per action: `src/engine/combatRules.js:277` `candidateState`, `src/model/ownedGameProfile.js:47` `separate`, `src/model/mechanicsKernel.js:194` `queryBinding` and `:78` `compileBindings`, `structuredClone` | about 910 ms self time | Each action deep-clones the whole combat context, walks the owned-profile graph to decide what it may skip, re-clones binding config on every query and recompiles bindings. Pure JS, no layout. |
| 5 | `src/ui/alternativeAuraRenderer.js:40` `draw` (`:48` read, `getImageData`) | `getImageData` 182 ms, draw 90 ms, 19 forced layouts 91 ms | A canvas shadow pass per figure per effect frame, a 1x1 `getImageData` readback to force materialisation (a synchronous canvas flush), and a layout read inside the draw. |
| 6 | hand fit: `src/ui/components/hand.js:137` `readStripBox`, `src/ui/components/illustratedCardFitter.js:27,99` | 10 forced layouts 117 ms; fitter 14 to 22 forced layouts, 67 to 104 ms | Every hand render re-fits card text with a 7-pass binary search that writes `font-size` and reads `scrollHeight` in a loop. |
| 7 | `src/ui/fx.js:64` `rectOf` and `src/ui/components/combatTargetHud.js:17,339` | 11 + 12 forced layouts, about 180 ms | Flight and HUD placement read element rects straight after the DOM changed. |
| 8 | drag: `src/ui/screens/combat.js:2770` `dropPlan` and `:2797` `updateDropTarget`; `src/ui/viewViewport.js:20` `logicalViewport` (hand scenario) | 128 forced layouts, 207 ms for two drags; `logicalViewport` 159 ms | `dropPlan` runs on every pointer move: `elementFromPoint`, `inspectionPlayAction`, and `logicalViewport` (which reads `innerHeight`, a layout flush). 64 moves per drag. |
| 9 | card inspect modal: `src/ui/components/modalShell.js:609` `focusFirst` and `:233` `release` (hand scenario) | `focus` 505 ms self, 8 + 6 forced layouts, 490 ms | `focus()` on opening, and returning focus on closing, restyles and re-lays out the whole 960-node combat screen (27 filtered elements) twice per inspect. |
| 10 | persistence on the action path: `src/engine/combatExpansionSave.js:5` `commitExpansionCandidate`, `src/engine/combatSnapshot.js:56` `serializeCombatSnapshot`, `src/model/rewardTransaction.js:2` `persistRewardChange` (transitions); map `src/ui/components/mapboard.js:673` `viewSnapshot`, `src/model/state.js:1673` `serializeRun` | transitions about 210 ms; map 134 + 41 ms (14 forced layouts) | Snapshots and saves are serialised synchronously in the input handler (a `structuredClone` or a JSON of the run), and the map scroll handler reads `scrollLeft`, `scrollTop` and `clientWidth` on every scroll event. |

Not isolated (no A/B run yet): the cost of the 25 CSS `filter`, 20 `box-shadow`
and 137 `text-shadow` elements on screen. Paint (367 ms), pre-paint (195 ms),
layerize (388 ms) and commit (501 ms) on the main thread add about 1.45 s in
combat, and software raster on workers adds 1 s, but the trace cannot tell which
rule is expensive. Images are not the problem here: decode on workers is 151 ms
in combat, and no element has `backdrop-filter`, a blend mode or `will-change`.
The probe's census counts 60 of 65 combat images as larger than 1.5x their device-pixel box,
but total decoded size (86.7 Mpx) is about equal to the pixels shown (78.5 Mpx), so this is
a small, unproven gain, not a hot spot.

## Suggested fixes, ranked (not implemented)

Gains are estimates against the 4x-throttled combat window and need a re-run of
the probe to confirm.

1. **One read phase, one write phase per frame for combat layout** (spots 1, 2, 3, 6, 7): route `separateRackedIntents`, `combatTools.measure`, `frameMeasure.measure`, `readStripBox`, `rectOf`, and the HUD placers through one rAF scheduler that reads everything first and writes after; make `frameMeasure`'s cache live for the whole frame, not one microtask. Forced layout and style total 1.8 s of 2.6 s of style plus layout in combat, so expect **-1.2 to -1.6 s main-thread per turn (about -12%)** and the biggest drop in long tasks and p95.
2. **Engine transaction cost** (spot 4): memoise `queryBinding` per (binding, query, params) since config is immutable, compile bindings once per fight, cache the `ownedGameProfile` separation by identity, and clone only changed branches (or use a journal) instead of the whole context per candidate. Expect **-0.6 to -0.8 s per turn** (about -6%).
3. **Move saves and snapshots off the input path** (spot 10): serialise after the enemy turn or in `requestIdleCallback`, and coalesce the map's per-scroll `viewSnapshot` with a cached viewport size. Expect **-0.2 to -0.3 s in combat and transitions**, and fewer long tasks over 50 ms.
4. **Inspect modal focus and release** (spot 9): add `contain: layout style` on the card layer and the modal veil, or focus after the open transition; expect **about -0.5 s per inspect session**, making an open or close feel instant.
5. **Throttle drag targeting to one pass per frame and cache geometry at drag start** (spot 8): `elementFromPoint` only when the pointer crosses a target boundary; read `logicalViewport` once. Expect **128 forced layouts down to about 20, -0.15 to -0.2 s per drag**.
6. **Aura renderer** (spot 5): drop the `getImageData` materialise except where a test needs it, keep the cached surface across frames, and read no layout inside `draw`. Expect **-0.2 s per turn**.
7. **Cache card text fits** (spot 6): key the font-size result by card, text and width; only re-fit on change; replace the 7-pass probe with one measured pass. Expect **-0.1 to -0.15 s per hand render**.
8. **CSS containment** on `.hand`, `.combatant`, HUD panels and the modal (`contain: layout style paint`): 285 style recalcs cost 1.3 s (4.6 ms each) because every change invalidates the 960-node screen. Expect **-20 to -30% of style time (-0.3 s)**; unverified.
9. **Paint cost experiment, then act**: A/B the 25 filters, the text-shadows and the box-shadows with the probe (one rule at a time) before deciding; gain unknown.
10. **Change the gate**: replace "median <= 16.7 ms" in FINISH §7 with p95 and a long-task budget so the criterion can fail.

Fixes 1 to 3 together aim at about -2.2 to -2.7 s of the 10.8 s busy window (about -22%)
and about half of the 5.7 s of blocking, the first step to "2x smoother". Fixes 4 to 8
carry the hand and transitions scenarios the rest of the way.

Proposed acceptance for "2x smoother" at this profile, on `node tools/perf-probe.mjs`:
combat p95 frame <= 100 ms (now 217) and frames over 33 ms <= 8% (now 17%);
combat long-task blocking <= 2.8 s (now 5.7 s); hand p95 <= 33 ms (now 50);
map and transitions no worse than now.

Deciding these on one run is noise. Certify with `node tools/perf-probe.mjs --certify`
(combat and hand, 5 runs, no CPU profile): it prints per-run rows, the trimmed median
(min and max dropped), the min-max spread, the counts of frames over 33 and 100 ms next to
the percentages, and PASS/FAIL per target on the trimmed median. A fixed JS loop is timed
under the throttle before each pass (a pass more than 15% off the first is rerun, twice at
most, then flagged UNSTABLE), and the probe refuses to start when the host's load1 is above
half its cores (`--force` overrides). The report also lists long frames and render counts by
phase (tap, playback, finish, enemy turn, idle).

## What this does not cover

- **No real phone and no GPU.** Headless Chromium rasterises in software, so
  paint and raster numbers stand in for a phone GPU; main-thread script, style
  and layout are the throttled numbers that transfer. Safari/iPhone is untested
  (RELEASE-CHECKLIST: iPhone run still open).
- **Probe overhead** is in the windows: a rAF loop, `getAnimations` every 15th frame,
  and hit-testing before each tap (the last three are filtered out of the hot-spot lists).
  It is the same in every scenario, so comparisons hold, but absolute numbers are a little high.
- **One seed, one class** (`PERF1`, Reaver, one enemy). A multi-enemy fight and a boss
  are heavier and unmeasured. The opening hand buys two cards, not three.
- **Not measured:** startup under 3 s, memory growth over 30 minutes (the other two
  §7 lines), co-op, and the Armoury, shop and compendium screens.
- **A swallowed touch (unverified):** on the act map the first drag at (195, 420)
  did not pan, and drags from other points did. The probe finds a point that pans
  in unmeasured setup. If a real thumb at the screen centre cannot pan the map,
  that is a bug, but it is outside this step.
- **Strike's inspect button** sits under another element at 390x844 (`hit DIV`), so
  the hand scenario inspects the first Attack instead. Also unverified as a user-facing bug.
