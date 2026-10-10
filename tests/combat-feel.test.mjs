// SCREEN SHAKE AND HIT-STOP (SPEC §7.4, D51; docs/FINISH.md §5 "Every HP hit
// shakes the screen, scaled by damage, and big hits stop").
//
// The amplitude steps and the hit-stop row are data (content/combatFeel.js);
// these tests read the boundaries from the table, check that overriding a row
// changes the answer (D1), and pin how ui/fx.js and styles/combat.css use
// them. The browser half — that a paused figure really holds — is not here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SHAKE_STEPS, SHAKE_MAX_PX, HIT_STOP, shakePxFor, hitStopMsFor, combatFeelIssues } from '../src/content/combatFeel.js';
import { ANIM_SPEEDS, playTimeline, setAnimSpeed } from '../src/ui/fx.js';
import { registerStage } from '../src/ui/services/PoseAnimator.js';
import { playReaverAttack } from '../src/ui/reaverAttack.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { haptic } from '../src/ui/haptics.js';
import { createEnemyPoseStage } from '../src/ui/enemyPoseStage.js';

const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the shipped table is valid, and the top step is the old 4 px from 15 HP', () => {
  assert.deepEqual(combatFeelIssues(), []);
  const top = SHAKE_STEPS.at(-1);
  assert.deepEqual({ minHp: top.minHp, px: top.px }, { minHp: 15, px: 4 });
  assert.equal(SHAKE_MAX_PX, 4);
});

test('every HP hit shakes, by the step its HP reaches; no HP, no shake', () => {
  assert.equal(shakePxFor(0), 0, 'a fully blocked hit does not shake');
  for (const [i, step] of SHAKE_STEPS.entries()) {
    assert.equal(shakePxFor(step.minHp), step.px, `${step.minHp} HP reaches its own step`);
    if (step.minHp > 1) assert.equal(shakePxFor(step.minHp - 1), i ? SHAKE_STEPS[i - 1].px : 0, `${step.minHp - 1} HP stays on the step below`);
  }
  assert.equal(shakePxFor(999), SHAKE_MAX_PX, 'never over the cap');
});

test('the hit-stop starts at its floor', () => {
  assert.equal(hitStopMsFor(HIT_STOP.minHp - 1), 0, `${HIT_STOP.minHp - 1} HP: no hold`);
  assert.equal(hitStopMsFor(HIT_STOP.minHp), HIT_STOP.ms, `${HIT_STOP.minHp} HP: ${HIT_STOP.ms} ms`);
  assert.deepEqual({ minHp: HIT_STOP.minHp, ms: HIT_STOP.ms }, { minHp: 6, ms: 60 });
});

test('overriding each row changes the answer (D1)', () => {
  assert.equal(shakePxFor(3, [{ minHp: 2, px: 3 }]), 3);
  assert.equal(shakePxFor(3, [{ minHp: 5, px: 3 }]), 0);
  assert.equal(shakePxFor(3, [{ minHp: 1, px: 9 }]), SHAKE_MAX_PX, 'the cap holds over a mistyped row');
  assert.equal(hitStopMsFor(6, { minHp: 6, ms: 0 }), 0, 'ms 0 turns the hit-stop off');
  assert.equal(hitStopMsFor(4, { minHp: 3, ms: 90 }), 90);
});

test('a malformed table is refused, naming its row', () => {
  assert.match(combatFeelIssues([{ minHp: 0, px: 1 }]).join(), /SHAKE_STEPS\[0\]\.minHp/);
  assert.match(combatFeelIssues([{ minHp: 1, px: 5 }]).join(), /SHAKE_STEPS\[0\]\.px/);
  assert.match(combatFeelIssues([{ minHp: 5, px: 1 }, { minHp: 5, px: 2 }]).join(), /SHAKE_STEPS\[1\]\.minHp must rise/);
  assert.match(combatFeelIssues(SHAKE_STEPS, { minHp: 6, ms: -1 }).join(), /HIT_STOP\.ms/);
});

test('fx shakes every HP hit by its HP and holds the figures on paced playback only', () => {
  const fx = src('src/ui/fx.js');
  assert.match(fx, /shake\(ctx\.combatEl, shakePxFor\(parts\.residual\)\)/, 'the damage visual shakes by the residual HP');
  assert.match(fx, /combatEl\.style\.setProperty\('--shake-px', `\$\{px\}px`\)/, 'the amplitude reaches the CSS');
  assert.match(fx, /document\.body\.classList\.contains\('no-shake'\) \|\| reducedMotionRequested\(\)\) return;/, 'the setting and reduced motion drop the shake');
  assert.match(fx, /activeActorAnimation\.hold\(holdMs\)/, 'a painted swing is held by its own sequence');
  assert.match(fx, /schedule\(stepV, speed\.stepMs \+ \(held \? holdMs : 0\)\)/, 'the hold lengthens that hit\'s step');
  assert.match(fx, /flash\(anchor, 'hitflash', heavy \? 380 : 220, held\)/, 'the recoil keeps its authored duration and extends cleanup by the pause');
  assert.match(fx, /actorAnimation\.totalMs \+ heldMs/, 'all played holds lengthen recovery');
  assert.match(fx, /if \(now < shakeUntil && px < shakeNow\) return;/, 'a smaller hit does not cut a bigger shake short');
  // Instant has no paced timeline: playTimeline falls back to animateEvents,
  // which has no actor swing and no hit-stop.
  assert.equal(ANIM_SPEEDS.instant, null);
  const fast = fx.slice(fx.indexOf('export function animateEvents'), fx.indexOf('export function groupBeats'));
  assert.doesNotMatch(fast, /hit-stop|hitStopMsFor/, 'the instant path never holds');
});

test('the CSS pauses a held figure and scales the shake by --shake-px', () => {
  const css = src('styles/combat.css');
  assert.match(css, /^\.hit-stop \{ animation-play-state: paused !important; \}$/m);
  assert.doesNotMatch(css, /\.hit-stop \*/, 'descendants (the idle bob) keep their clock');
  assert.match(css, /@keyframes shake \{.*var\(--shake-px, 4px\)/);
});

test('a painted sequence holds: its remaining frames move back by the hold', async () => {
  // reaverAttack's handle and the painted stage both expose hold(ms).
  assert.match(src('src/ui/reaverAttack.js'), /hold\(ms\) \{[\s\S]{0,250}schedule\(Math\.max\(0, due - Date\.now\(\)\) \+ ms\);/);
  assert.match(src('src/ui/paintedOutfits.js'), /hold\(ms\) \{[\s\S]{0,600}due: entry\.due \+ ms/);
  assert.match(src('src/ui/screens/combat.js'), /hold: \(ms\) => \{ stage\?\.hold\?\.\(ms\); \}/);
});

function drive(t, fn) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 });
  withKitDom((dom, win, listeners) => {
    const actor = dom.document.createElement('div');
    const target = dom.document.createElement('div');
    const layer = dom.document.createElement('div');
    const combatEl = dom.document.createElement('div');
    actor.className = target.className = 'sprite';
    const holds = [], reactions = [], buzzes = [];
    let flushes = 0, completed = 0, settled = 0;
    const oldSink = haptic.sink;
    haptic.sink = (id) => buzzes.push([id, Date.now()]);
    registerStage(target, {
      play: (pose, ms) => { reactions.push([pose, ms]); return true; },
      hold: (ms) => holds.push(['target', ms, Date.now()]),
      settle: () => settled++,
    });
    const ctx = { layer, combatEl, anchorFor: (id) => id === 'enemy' ? actor : target,
      animateActor: () => ({ impactMs: 100, totalMs: 800,
        hold: (ms) => holds.push(['actor', ms, Date.now()]), cancel() {} }),
      onFlush: () => flushes++, onBeatApplied() {} };
    const events = (amounts, opener) => [opener || { type: 'enemyMoveStarted', sourceId: 'enemy', kind: 'attack' },
      ...amounts.map((amount) => ({ type: 'damageDealt', sourceId: 'enemy', targetId: 'player', amount }))];
    const start = (amounts, opener) => playTimeline(events(amounts, opener), ctx, () => completed++);
    const fire = (name) => { for (const cb of [...(listeners.get(name) || [])]) cb(); };
    try { fn({ dom, actor, target, combatEl, holds, reactions, buzzes, start, fire,
      tick: (ms) => t.mock.timers.tick(ms), stats: () => ({ flushes, completed, settled }) }); }
    finally { haptic.sink = oldSink; setAnimSpeed('normal'); }
  });
}

test('each qualifying multi-hit impact holds both figures, and buzzes at first impact once', (t) => {
  drive(t, ({ start, tick, holds, buzzes, reactions }) => {
    start([6, 10]); tick(100);
    assert.deepEqual(holds, [['actor', 60, 10100], ['target', 60, 10100]]);
    assert.deepEqual(reactions, [['hit', 220]], 'target playback keeps its base duration');
    assert.deepEqual(buzzes, [['damageTaken', 10100]], 'buzz arrives before recovery');
    tick(150);
    assert.deepEqual(holds.slice(2), [['actor', 60, 10250], ['target', 60, 10250]]);
    for (let i = 0; i < 100; i++) tick(20);
    assert.equal(buzzes.length, 1, 'recovery does not buzz twice');
  });
});

test('a click during hit-stop clears both held figures and flushes once without a second buzz', (t) => {
  drive(t, ({ start, tick, actor, target, fire, stats, buzzes }) => {
    start([6]); tick(100);
    assert.ok(actor.classList.contains('hit-stop'));
    assert.ok(target.classList.contains('hit-stop'));
    fire('pointerdown');
    assert.ok(!actor.classList.contains('hit-stop'));
    assert.ok(!target.classList.contains('hit-stop'));
    assert.equal(stats().settled, 1);
    fire('pointerup'); tick(1);
    assert.equal(stats().flushes, 1);
    assert.equal(stats().completed, 1);
    assert.equal(buzzes.length, 1);
  });
});

test('a counter beat holds on an HP hit of 6 or more, like an attack beat (SPEC §7.4)', (t) => {
  drive(t, ({ start, tick, holds }) => {
    start([6], { type: 'combatCounterTriggered', sourceId: 'enemy', targetId: 'player' }); tick(100);
    assert.deepEqual(holds, [['actor', 60, 10100], ['target', 60, 10100]], 'a counter hit of 6 HP holds both figures');
    for (let i = 0; i < 100; i++) tick(20);
  });
});

test('a counter beat does not hold on an HP hit under 6', (t) => {
  drive(t, ({ start, tick, holds }) => {
    start([5], { type: 'combatCounterTriggered', sourceId: 'enemy', targetId: 'player' }); tick(100);
    assert.equal(holds.length, 0, 'a counter hit of 5 HP does not hold');
    for (let i = 0; i < 100; i++) tick(20);
  });
});

for (const mode of ['instant', 'reduced-motion', 'no-shake']) {
  test(`${mode} applies its own effect suppression`, (t) => {
    drive(t, ({ dom, start, tick, holds, combatEl }) => {
      if (mode === 'instant') setAnimSpeed('instant');
      else dom.document.body.classList.add(mode);
      start([6]); tick(100);
      assert.equal(holds.length, mode === 'no-shake' ? 2 : 0);
      assert.equal(combatEl.classList.contains('shake'), mode === 'instant');
      for (let i = 0; i < 100; i++) tick(20);
    });
  });
}

test('Reaver hold adds exactly the pause to the remaining frame time', (t) => {
  drive(t, ({ dom, actor, tick }) => {
    const figure = dom.document.createElement('div'); figure.className = 'class-sprite'; actor.appendChild(figure);
    // The fixture does not parse :scope; use the actual direct child for that query.
    const query = actor.querySelector.bind(actor);
    actor.querySelector = (selector) => selector === ':scope > .class-sprite' ? figure : query(selector);
    const sequence = playReaverAttack(actor, { frameMs: 20, impactMs: 40, totalMs: 1200 });
    const image = actor.children.at(-1);
    tick(15); sequence.hold(60);
    tick(64); assert.equal(image.dataset.frameId, 'P01');
    tick(1); assert.equal(image.dataset.frameId, 'P02');
    sequence.cancel();
    assert.equal(figure.hidden, false);
  });
});

test('an ordinary enemy pose holds past its original settle deadline', (t) => {
  drive(t, ({ dom, actor, tick }) => {
    const facing = dom.document.createElement('div');
    const idle = dom.document.createElement('img'); idle.dataset.artSource = 'enemy-poses';
    const stage = createEnemyPoseStage(actor, facing, idle, 'hollowSoldier', { hp: 10, maxHp: 10 });
    for (const frame of facing.children) frame.dispatchEvent(new globalThis.Event('load'));
    stage.play('hit', 220); tick(15); stage.hold(60);
    tick(205); assert.equal(actor.dataset.pose, 'hurt');
    tick(59); assert.equal(actor.dataset.pose, 'hurt');
    tick(1); assert.equal(actor.dataset.pose, 'idle');
    stage.dispose();
  });
});
