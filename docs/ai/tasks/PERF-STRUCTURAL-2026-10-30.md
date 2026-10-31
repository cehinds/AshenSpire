# perf-g design: structural rework of the combat play path

Read-only survey of worktree /home/user/wt/perf @ 0c62e7e6f4 (2026-10-30). Owner constraints: no visual change (pixels, animation timing, HUD frequency identical); yardstick `node tools/perf-probe.mjs --scenario combat,hand --runs 3 --throttle 4`; targets combat p95 ≤100 ms (now ~120-160), frames >33 ms ≤8% (now ~12-13%), combat blocking ≤2.8 s (now ~2.9-3.1), hand p95 ≤33 ms (now 33.4). Runtime-hash files are off limits (engine/kernel, engine/runtime, contracts, gameConfig.js, fixCoreMechanics.js, mechanicsKernel.js). src/model must not use document/window/localStorage.

## 0. What a play costs today and where the full render sits

Tap task (~310 ms at 4x): `tap` combat.js:2983 → `playCard` 3584 → `takeSnapshot` 3644 (hand previews hit the previewMemo, cheap) → `dispatch` 3647 → `flyCard` 3657 → `afterDispatch` 3661: visualPlans 3328-3336, `renderCombatTools` 3358 (formats the WHOLE eventLog via `combatLogEntries` 1727 on every call), `syncCardSelection` 3359 (syncHitChances + applyTargetLayer + refreshAim).

Playback: `onBeatApplied` 3427 marks `beatDirty` 568; `flushBeatRender` 3470 does renderTopbar + renderCombatantStage({fit: geometry}) + renderHand (card events only) + renderControls + renderCombatTools. renderHand during playback renders `disp.hand` with `disp.handPreviews` but computes `affordable` from LIVE `combat.player` (2443) → cards whose affordability flipped are REBUILT at the cardPlayed beat, then rebuilt AGAIN at finish when their previews change.

Finish: `finishPlayback` 3367-3416 → `render()` 3378 (fx.js onDone 1180-1188 / legacy finish 1280 → done). `render()` 1680-1712 runs, in order: primeStripBox, renderTopbar (keyed 1742: [p, pv, settings] → innerHTML rebuild of blight HUD + resbars + relic rail), syncEditLock, renderPotionTray, renderCombatantStage({fit:false}) → renderPlayer 2141 (renderKey 2148 is JSON of the whole player + dv(p) + ...; a change rebuilds EVERY slot via `updateCombatantFrame` combatantFrame.js:20, which `replaceChildren`s leading 31 and removes all card children 36) and renderEnemies 2266 (renderKey 2281 includes `combat.player` → any player change rebuilds every enemy frame: intentEl, info button, nameplate, meterBars 2024, statusRow 1845), renderControls 2591 (expansion controls innerHTML unconditional 2634; endTurnHasPlayable previews), renderCombatTools, renderHand({refreshHitChances:false}) 2381 (stateKey 2400 changed → every card re-quoted via previewCard = candidateState ~20 ms/card at 4x; changed signatures → renderCard rebuild hand.js:418 + fitIllustratedCards), syncHitChances 1967, combatTools.flushGeometry 266 (forced layout: first reader after all the writes), battlefieldStage.refresh 660 (full fit: fitLabels, field/frames/art rects, backdrop fit), applyTargetLayer 832 (writes `frame.inert` on every combatant unconditionally, 843), refreshAim, setHintMode, scheduleAutoCombat.

Why it is ~150 ms script + ~40 ms layout: (a) the stage keys are whole-entity JSON so one stamina/status change rebuilds ~40-60 nodes per combatant for all combatants; (b) the hand re-quotes all cards synchronously; (c) 2-3 cards rebuild (innerHTML face + fit + inspection binding); (d) the first layout reader after those writes pays one big flush; (e) renderCombatTools reformats the entire log 3+ times per play.

What genuinely differs at finish vs the last beat flush: player stamina/maxStamina, stanceId/combatStance, combatEvade, statuses (durations/stacks the beats do not carry), persistentWard/wardMeter, enemies' intentPreview (projectCombatIntent on the final state), piles/hand (post-draw), energy for affordability, End Turn pulse, action counts. Everything else (HP, block, poise, hp bars) is already on screen from the beats.

## A. Incremental end-of-playback update (replace `render()` at 3378)

Keep `render()` for mount/resync/`__renderCombatForShot` (1717). Add `finishRender()` = the same sequence, but every renderer returns `wrote` (did it touch DOM) and the geometry steps run only when something wrote:

1. Stage keys per SLOT, not per entity (combat.js renderPlayer/renderEnemies + combatantFrame.js). Per combatant: `leadingKey` (intent shown via `intentEl` inputs: shown intent, followUps, def.name, alive, targeting idx), `nameKey`, `metersKey` (resourceBarPlan rows + protectionPresentation + evasion/precision + arcane + proc bars), `statusKey` (statuses entries + pips/bars plan + armed()), `chipsKey` (stance/companion/evade chips), `classKey` (classNames/aria/inert/dataset.stature). Add `updateCombatantSlots(frame, { leading?, name?, meters?, statuses?, chips?, classNames })` in combatantFrame.js that replaces only the slots passed, in the same insertion order as `updateCombatantFrame` (name → meters → statuses (leadingHost on enemy/alternative) → other trailing → action glyph re-append) so the DOM is byte-identical. Drop `combat.player` from the enemy renderKey (2281); no enemy slot reads it (hit badges are synced in syncHitChances; intents read `combat` through projectCombatIntent, which is in the leadingKey). Expected: 40-70 ms/play at finish, and the same per HP beat flush. Risk: DOM order/attribute drift → HUD placement differs. Mitigation: a test asserting `frame.outerHTML` after slot update === after a fresh `combatantFrame(slots)`; pixel diff.

2. Identical-write guards on the finish path: applyTargetLayer 843 `if (frame.inert !== v) frame.inert = v`, aria-disabled set/remove guards; renderControls: key the expansion controls innerHTML (2634) and end-turn dataset writes; renderTopbar: key the resbars host by the `mainPlan` rows (values), not the whole player object. Then `combatTools.flushGeometry()` and `battlefieldStage.refresh()` read a clean layout and their guarded writes are no-ops: that removes most of the ~40 ms layout.

3. Geometry: call `battlefieldStage.refresh()` only if a size-changing stage slot wrote (leading/statuses/chips/meters count) or `handStrip.render` reported `reshaped`; otherwise `battlefieldStage.placeHitBadges()` only (hand.js already dispatches `handlayoutchange` → stage `schedule()` 1554 when the fan plan changes; keep the synchronous refresh for reshaped to preserve frame timing). Have `handStrip.render` return `{ reshaped, rebuilt }`.

4. Hand at finish: see C.1 / T3 and B.1 / T2. renderHand stays keyed as now.

Existing keys: topbarRenderKey 1742, playerRenderKey 2148, enemy record.renderKey 2281, handRenderKey/stateKey 2400-2402, handPreviewCache 2414, card signature hand.js:388, fit cache illustratedCardFitter.js (fitSignature), racksKey battlefieldStage.js:329, combatTools entryKey 319/heightKey 214, syncHitChances in-place badge diff 1983-1991, syncPlayerActionIntent maneuver guard 924. Missing: slot-level stage keys, renderControls keys, resbars value key, applyTargetLayer write guards, a `wrote` return channel, a refresh-key for battlefieldStage.refresh.

Tests: tests/combat-beat-repaint-coalesce.test.mjs asserts `render()` inside finishPlayback and onFlush → change to assert `finishRender()`, and that onFlush (skipped playback) still calls full `render()` (a skip can leave arbitrary beats unapplied; keep it full). tests/combat-render-geometry-order.test.mjs (vm fixture) must keep passing for `render()`; add the same fixture for `finishRender` asserting refresh is skipped when nothing wrote and runs when the hand reshaped.

## B. Split the long task without changing any frame

1. Post-dispatch previews (biggest). After `dispatch` the fight state is final for the whole ~1.5 s playback; previewMemo (src/ui/models/PreviewMemoModel.js, `kept`, invalidated only by dispatch) keeps results until the next dispatch. Pre-warm during playback: for each card in `combat.piles.hand`, `previewCard(combat, id, undefined, upcastRanksByCard.get(id))` (the exact key renderHand uses for unselected cards 2435, cardTargets 822, takeSnapshot 1244), plus `previewMemo.memo` entries for `projectCombatIntent` per enemy, plus `endTurnHasPlayableCard` inputs. Finish then hits the memo: ~80-120 ms leaves the finish task. Scheduling: `requestIdleCallback`, one card per callback, only when `deadline.timeRemaining() >= 24` (a preview is 15-25 ms at 4x; less budget means a rAF is pending and the chunk would make a >33 ms frame — skip and retry next idle). Cancel on dispatch/teardown. Worst case no idle slot → finish pays as today. Owner: PreviewMemoModel.js (`prewarm(jobs)` + cancel on invalidate); call site in afterDispatch after visualPlans.
2. Combat log formatting: `renderCombatTools` 1722-1728 formats `combatLogEntries(combat.eventLog.slice(0, n))` on every call and `combatToolsModel` deep-freezes the entries; `combatTools.update` keys on `JSON.stringify([entries, palette])` (319) and only feeds open readers. eventLog is append-only: memoise entries by (eventLog identity, length, registries) and extend incrementally; when no log reader is open (`!state.open && !state.fullLog && !state.drawerLog`) pass entries lazily (thunk) so nothing is formatted until a reader opens. 10-30 ms/play, growing with fight length. Owner: combatTools.js + CombatToolsModel.js (+ one call site in combat.js).
3. Idle warming of draw-pile card faces: NOT recommended (engine-state order, stale-face risk, small gain).
4. Save: nothing per play (no persist in playCard/afterDispatch). Nothing to defer.
5. `visualPlans` (3328-3336) must precede the first beat; leave.

## C. DOM/style cost (961 nodes)

Node sources (estimate): hand 5 cards × ~50-60 nodes (illustratedCard.js:41 planes/layers, backdrops, tag rail, rank, key-hint, hit lane, info button, upcast controls with hidden select) ≈ 275; combatant frames 3-4 × ~45; topbar HUD ~100; target-hud layer and hidden per-enemy panels; formation grid cells (display:none, cheap); hint bar; fx-layer; svg target-arrow. What is paid per play is rebuilt subtrees and forced flushes, not node count.

1. Face patching (hand.js renderCards 388-507 + card.js paint 329-389): when a signature changes but the face HTML is the same (only `affordable`/`availability` changed), do not rebuild: toggle `.unaffordable`/aria and give the inspection door a mutable record the `open` closure reads at open time (card.js ~434-440 `bindCardInspection(... open: ...)` captures `opts.availability`/`opts.preview` — the staleness that forced the revert at 0c62e7e6f4). When rules/cost text changes, replace only `.ic-text[data-card-binding]` innerHTML / cost spans, `scheduleCardFits([el])`, re-bind damage receipt; the fitter's signature cache makes unchanged text free. Byte-identity test: `el.outerHTML` after patch equals a fresh `renderCard` for the new entry (extend tests/card-inspection-rebuild.test.mjs). Saves ~30-40 ms per rebuilt card; 1-3 cards twice per play.
2. Pooling: cards already reused by instanceId (renderedCards), frames per enemy (enemyFrames). Nothing further without changing the DOM.
3. `contain`/`content-visibility`: earlier null result is expected (cost is flush count, not scope; content-visibility only helps offscreen). `contain: layout` on `.card`/`.combatant` changes containing blocks for absolutely positioned descendants (intent/mini-HUD racks positioned via CSS vars) — visually risky. One bounded, pixel-diffed experiment only after T1-T3; drop unless 7/7 shots identical.

## D. Hand p95 on the 2-frame edge

rAF deltas are vsync-quantised (16.7/33.4/50…), so "p95 ≤ 33" is only reachable as p95 = 16.7: frames >16.7 ms must be <5% (today 9.5-14.8%, ~55-80 of ~550). Sources (perf-f/hr.txt): modal close `release` ×6 153.7 ms style (modalShell.js close 539-556: `unregister.unlock()` removes `inert` from #app children (modalManager.js syncPage 139-190, set at 188) → the whole combat subtree restyles; `opener.focus()` in bindModalDismiss 233-235 is the forced flush); open: mount + inert set + deferred focusFirst 601-614; `dropPlan` ×47 S 111.9 + L 35.8 (combat.js 2788-2822: `document.elementFromPoint` 2796 flushes style dirtied by the previous move's writes); updateDropTarget 2823-2833 writes `combatEl.dataset.dropState` (root attribute → subtree invalidation), `dragGhost.dataset.dropState` and `verdict.textContent` UNGUARDED every move; `applyTargetLayer` on drag begin/end toggles `frame.inert` per combatant (843); separateRackedIntents ×9; logicalViewport.

1. Guard the three per-move writes in updateDropTarget (same-value skip). Zero risk.
2. Scope inert restyle: (a) on close, run `unlock()` + focus restore in the frame AFTER `veil.remove()` (veil goes in frame N, inert lifts in N+1; pixels identical since inert has no rendering); (b) on open, apply inert in the rAF that already defers focusFirst so mount and inert restyle land in different frames; (c) limiting `want` to hand-area/field roots only after a11y review — not this wave. Owner: modalManager.js (`unlockLater`) + modalShell.js.
3. applyTargetLayer inert guards (A.2) remove drag-begin/end restyles when values do not change.
Acceptance for hand: `>16.7 %` ≤ 4.5 over 5 runs (trimmed), which yields p95 = 16.7.

## E. Measurement (tools/perf-probe.mjs)

1. `--runs 5` default for certification; per-run p95/over33/blocking plus trimmed median (drop min and max) and spread; quantised equivalents (for combat ~260 frames, p95 ≤ 100 ⇔ at most 12 frames ≥ 116.7 ms): add "frames > 100 ms (count)" and "frames > 33 ms (count)" columns. Calibration pre-pass (fixed JS loop timed under the same throttle; reject and rerun a pass deviating > 15%) and host-idle check from /proc/loadavg (refuse when load1 > cores/2 unless `--force`). Targets unchanged; they become decidable.
2. Per-mode split: INIT 62-96 already installs `__perfCount`; also record `[name, performance.now()]` marks, mark input taps (`__perfMark('tap')` before each touch), attribute each long frame to a phase (tap → first beatFlush = "tap task", beatFlush..finishRender = "playback", finishRender frame = "finish", `combatEl.dataset.turn==='enemy'` = "enemy turn"); print "long frames by phase" and "render counts by phase" (the `play` scenario table 565-572 shows 0 full renders because its window ends before finish). Add counter `finishRender`.
3. Keep pass B (CPU profile) as is.

## Ranking (expected ms saved per play at 4x / risk)

1. T2 previews pre-warm: 80-120 ms off the finish task / low.
2. T1 slot-level stage render + write guards + conditional refresh: 60-100 ms (finish) + 10-30 per HP beat / medium (DOM identity).
3. T3 hand face patching: 30-80 ms / medium-high (door staleness; prior revert).
4. T4 combat log memo/lazy: 10-30 ms, grows with fight length / low.
5. T5 hand: inert deferral + write guards: converts ~10-20 long hand frames / medium (focus, a11y).
6. T6 probe: 0 ms / none; prerequisite for certifying.
Together 1-4 remove ~180-330 ms per play (of ~1.65 s), mostly from the single worst frame (finish 190 → ~70 ms), which is what p95 and blocking measure.

## Ordered worker tasks (one owner per file; combat.js edits serialised T1 → T2 → T4 → T5)

T6 (first, parallel with T1) — tools/perf-probe.mjs: trimmed median, count columns, calibration/idle guard, phase marks and per-phase table. Acceptance: 3 consecutive 5-run reports on the unchanged tree agree on pass/fail for every target; `play` scenario split table lists the finish frame.

T1 — src/ui/screens/combat.js + src/ui/components/combatantFrame.js (+ tests above): `finishRender()`, slot keys, `updateCombatantSlots`, write guards (applyTargetLayer, renderControls, renderTopbar value key), `wrote`/`reshaped` plumbing, conditional refresh. Acceptance: probe `play`: forced layouts ≤ 10 (now 26), forced style ≤ 20 (now 46), finish-frame work ≤ 90 ms; outerHTML identity test for slot updates; combat-beat-repaint-coalesce and combat-render-geometry-order updated and green; pixel diff identical.

T2 — src/ui/models/PreviewMemoModel.js (+ 3-line call site in afterDispatch after T1): `prewarm(jobs)` with idle scheduling and cancellation on invalidate. Acceptance: unit test that prewarmed keys equal the keys renderHand/cardTargets request; `candidateState` self time in the finish frame ≈ 0; no increase in `>33 %`.

T3 — src/ui/components/hand.js + card.js + cardInspection.js: face patching with a live availability record for the inspection door. Acceptance: outerHTML-after-patch === fresh render test; tests/card-inspection-rebuild and hand-forwards-surface green; door shows refreshed availability after an energy change without rebuild (new test); `paint card.js` self ≤ 1 card per play; pixel diff identical.

T4 — src/ui/components/combatTools.js + src/ui/models/CombatToolsModel.js (+ call site after T1/T2): incremental, lazy log entries. Acceptance: entries formatted only when a reader is open (counting stub test); renderCombatTools inclusive ≤ 3 ms per call.

T5 — src/ui/modalManager.js + modalShell.js (+ updateDropTarget guards in combat.js, last in the chain): deferred inert lift/apply, same-value drag writes. Acceptance: hand `>16.7 %` ≤ 4.5 and p95 = 16.7 over 5 runs; focus returns to the opener after close; pixel diff identical on inspect open/close shots (add 2 shots to shots.mjs: after `.hand-info-portal` tap and after Escape).

Pixel-diff protocol for every task: `node ../../scratchpad/perf-d/shots.mjs <root> <dir>/before-390 390 844` and `… 1280 800` on the base commit, same with `after-*` on the task branch, then `node ../../scratchpad/perf-d/diff.mjs <dir>`; require `over16: 0, bbox: null` for all shots (0-start … 6-nextturn, plus the two inspect shots for T5). shots.mjs uses page.clock so timing is deterministic; any non-null bbox is a visual change and fails the task.

## Critical files
- src/ui/screens/combat.js (render 1680, renderPlayer 2141, renderEnemies 2266, renderHand 2381, afterDispatch/finishPlayback 3320-3416, flushBeatRender 3470, dropPlan/updateDropTarget 2788-2833, applyTargetLayer 832)
- src/ui/components/hand.js (renderCards 336-518, signature 388)
- src/ui/components/combatantFrame.js (updateCombatantFrame 20-49)
- src/ui/models/PreviewMemoModel.js (createPreviewMemo)
- tools/perf-probe.mjs (INIT 62-96, SCENARIOS 273-370, summary 470-480, report 548-575)
Supporting: card.js (paint 329, setHandFaceBudget 489), cardInspection.js (openCardInspection 283, bindCardInspection 360), combatTools.js (update 286-327), modalManager.js (syncPage 139-190), modalShell.js (close 539-556, focusFirst 601-614), battlefieldStage.js (separateRackedIntents 331, refresh 660, selectionChanged 1538), tests/combat-beat-repaint-coalesce.test.mjs, tests/combat-render-geometry-order.test.mjs.
