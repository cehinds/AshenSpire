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
import { SHAKE_STEPS, SHAKE_STEPS_HP, SHAKE_MAX_PX, SHAKE_FLOOR_PX, BIG_HIT_SHARE, HUGE_HIT_SHARE, HIT_STOP, shakePxFor, hitStopMsFor, combatFeelIssues } from '../src/content/combatFeel.js';
import { BIG_HIT_SHARE as fxBigHitShare, HUGE_HIT_SHARE as fxHugeHitShare, ANIM_SPEEDS, playTimeline, setAnimSpeed, setBeatOrder, dmgClass, guardHitFloatParts } from '../src/ui/fx.js';
import { registerStage } from '../src/ui/services/PoseAnimator.js';
import { playReaverAttack, REAVER_ATTACK } from '../src/ui/reaverAttack.js';
import { runActionTimeline } from '../src/ui/actionTimeline.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { haptic } from '../src/ui/haptics.js';
import { actionPacing, setCombatPacing } from '../src/ui/animationPace.js';
import { createEnemyPoseStage } from '../src/ui/enemyPoseStage.js';
setCombatPacing({ combatSpeed: 1 }); // these timings are authored at x1; the shipped default is x1.25 (owner, 2026-10-26)

const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the shipped table is valid, and tops out at 10 px from 35% of max HP', () => {
  assert.deepEqual(combatFeelIssues(), []);
  const top = SHAKE_STEPS.at(-1);
  assert.deepEqual({ minShare: top.minShare, px: top.px }, { minShare: 0.35, px: 10 });
  assert.equal(SHAKE_MAX_PX, 10);
  assert.equal(SHAKE_FLOOR_PX, 1);
  assert.equal(BIG_HIT_SHARE, 0.20);
  assert.equal(HUGE_HIT_SHARE, 0.35);
  assert.equal(SHAKE_STEPS_HP.at(-1).px, 4, 'the 2026-10-05 absolute steps stay as the no-max-HP fallback');
});

test('fx still exports the two hit shares it re-exports from combatFeel', () => {
  assert.equal(fxBigHitShare, BIG_HIT_SHARE);
  assert.equal(fxHugeHitShare, HUGE_HIT_SHARE);
});

test('a hit shakes by its share of the target max HP: 1/2/4/7/10 px at 1/2/8/20/35%', () => {
  assert.equal(shakePxFor(0, 100), 0, 'a fully blocked hit does not shake');
  assert.equal(shakePxFor(-3, 100), 0);
  assert.equal(shakePxFor(1, 100), 1, '1% shakes the floor');
  assert.equal(shakePxFor(2, 100), 2);
  assert.equal(shakePxFor(7, 100), 2, 'just under 8% stays on the step below');
  assert.equal(shakePxFor(8, 100), 4);
  assert.equal(shakePxFor(19, 100), 4);
  assert.equal(shakePxFor(20, 100), 7);
  assert.equal(shakePxFor(34, 100), 7);
  assert.equal(shakePxFor(35, 100), 10);
  for (const step of SHAKE_STEPS) assert.equal(shakePxFor(step.minShare * 1000, 1000), step.px, `${step.minShare} of max HP reaches its own step`);
  assert.equal(shakePxFor(999, 100), SHAKE_MAX_PX, 'never over the cap');
  assert.equal(shakePxFor(5, 4), SHAKE_MAX_PX, 'a hit bigger than the whole max HP still stops at the cap');
});

test('with no known max HP the absolute-HP steps decide, as before', () => {
  assert.equal(shakePxFor(0), 0);
  for (const [i, step] of SHAKE_STEPS_HP.entries()) {
    assert.equal(shakePxFor(step.minHp), step.px, `${step.minHp} HP reaches its own step`);
    if (step.minHp > 1) assert.equal(shakePxFor(step.minHp - 1), i ? SHAKE_STEPS_HP[i - 1].px : 0);
  }
  assert.equal(shakePxFor(999, 0), 4);
  assert.equal(shakePxFor(15, NaN), 4);
  assert.equal(shakePxFor(15, -5), 4);
});

test('the hit-stop starts at its floor and doubles on a huge hit', () => {
  assert.equal(hitStopMsFor(HIT_STOP.minHp - 1, 100), 0, `${HIT_STOP.minHp - 1} HP: no hold`);
  assert.equal(hitStopMsFor(HIT_STOP.minHp, 100), HIT_STOP.ms, `${HIT_STOP.minHp} HP of 100: ${HIT_STOP.ms} ms`);
  assert.equal(hitStopMsFor(34, 100), 60, '34% is not yet huge');
  assert.equal(hitStopMsFor(35, 100), 120, '35% of max HP: 120 ms');
  assert.equal(hitStopMsFor(60, 100), 120);
  assert.equal(hitStopMsFor(2, 4), 120, 'a huge share of a tiny target holds the long stop; the HP floor does not gate it');
  assert.equal(hitStopMsFor(5, 12), 120, '5 of 12 HP (41.7%) is huge: 120 ms, though 5 is under the 6 HP floor');
  assert.equal(hitStopMsFor(5, 100), 0, '5 of 100 HP: under the floor and not huge: no hold');
  assert.equal(hitStopMsFor(6, 100), 60, '6 of 100 HP: the floor: 60 ms');
  assert.equal(hitStopMsFor(6, 10), 120, 'a hit of 6 HP that is 60% of a small target is huge');
  assert.equal(hitStopMsFor(35), 60, 'unknown max HP: the plain hold');
  assert.deepEqual({ ...HIT_STOP }, { minHp: 6, ms: 60, hugeShare: 0.35, hugeMs: 120 });
});

test('overriding each row changes the answer (D1)', () => {
  assert.equal(shakePxFor(3, 100, [{ minShare: 0.02, px: 3 }]), 3);
  assert.equal(shakePxFor(3, 100, [{ minShare: 0.05, px: 3 }]), SHAKE_FLOOR_PX, 'under the first step: the floor');
  assert.equal(shakePxFor(3, 100, [{ minShare: 0.01, px: 30 }]), SHAKE_MAX_PX, 'the cap holds over a mistyped row');
  assert.equal(shakePxFor(3, 0, SHAKE_STEPS, [{ minHp: 2, px: 3 }]), 3);
  assert.equal(shakePxFor(3, 0, SHAKE_STEPS, [{ minHp: 5, px: 3 }]), 0);
  assert.equal(hitStopMsFor(6, 100, { minHp: 6, ms: 0, hugeShare: 0.35, hugeMs: 120 }), 0, 'ms 0 turns the hit-stop off');
  assert.equal(hitStopMsFor(4, 100, { minHp: 3, ms: 90, hugeShare: 0.35, hugeMs: 150 }), 90);
  assert.equal(hitStopMsFor(50, 100, { minHp: 6, ms: 60, hugeShare: 0.5, hugeMs: 200 }), 200);
});

test('a malformed table is refused, naming its row', () => {
  assert.match(combatFeelIssues([{ minShare: 0, px: 1 }]).join(), /SHAKE_STEPS\[0\]\.minShare/);
  assert.match(combatFeelIssues([{ minShare: 1.5, px: 1 }]).join(), /SHAKE_STEPS\[0\]\.minShare/);
  assert.match(combatFeelIssues([{ minShare: 0.1, px: 11 }]).join(), /SHAKE_STEPS\[0\]\.px/);
  assert.match(combatFeelIssues([{ minShare: 0.2, px: 3 }, { minShare: 0.1, px: 5 }]).join(), /SHAKE_STEPS\[1\]\.minShare must rise/, 'a falling share');
  assert.match(combatFeelIssues([{ minShare: 0.1, px: 5 }, { minShare: 0.2, px: 3 }]).join(), /SHAKE_STEPS\[1\]\.px must rise/, 'a falling amplitude');
  assert.match(combatFeelIssues(SHAKE_STEPS, HIT_STOP, [{ minHp: 0, px: 1 }]).join(), /SHAKE_STEPS_HP\[0\]\.minHp/);
  assert.match(combatFeelIssues(SHAKE_STEPS, { ...HIT_STOP, ms: -1 }).join(), /HIT_STOP\.ms/);
  assert.match(combatFeelIssues(SHAKE_STEPS, { ...HIT_STOP, hugeMs: 30 }).join(), /HIT_STOP\.hugeMs/, 'hugeMs under ms');
  assert.match(combatFeelIssues(SHAKE_STEPS, { ...HIT_STOP, hugeShare: 0 }).join(), /HIT_STOP\.hugeShare/);
  assert.match(combatFeelIssues(SHAKE_STEPS, { ...HIT_STOP, hugeShare: 1.2 }).join(), /HIT_STOP\.hugeShare/);
});

test('fx shakes every HP hit by its HP and holds the figures on paced playback only', () => {
  const fx = src('src/ui/fx.js');
  assert.match(fx, /shake\(ctx\.combatEl, shakePxFor\(parts\.residual, [^\n]*maxHpFor/, 'the damage visual shakes by the residual HP as a share of the target max HP');
  assert.match(fx, /hitStopMsFor\(guardHitFloatParts\(event\)\.residual \|\| 0, [^\n]*maxHpFor/, 'the hit-stop reads the target max HP too');
  assert.match(fx, /combatEl\.style\.setProperty\('--shake-px', `\$\{px\}px`\)/, 'the amplitude reaches the CSS');
  assert.match(fx, /document\.body\.classList\.contains\('no-shake'\) \|\| reducedMotionRequested\(\)\) return;/, 'the setting and reduced motion drop the shake');
  assert.match(fx, /activeActorAnimation\.hold\(holdMs\)/, 'a painted swing is held by its own sequence');
  assert.match(fx, /schedule\(stepV, [^;\n]+ \+ \(held \? holdMs : 0\)\)/, 'the hold is added after the base visual delay, including any outcome lead');
  assert.match(fx, /flash\(anchor, 'hitflash', heavy \? 380 : 220, held\)/, 'the recoil keeps its authored duration and extends cleanup by the pause');
  assert.match(fx, /actorAnimation\.totalMs \+ heldMs/, 'all played holds lengthen recovery');
  assert.match(fx, /if \(now < shakeUntil && px < shakeNow\) return;/, 'a smaller hit does not cut a bigger shake short');
  // Instant has no paced timeline: playTimeline falls back to animateEvents,
  // which has no actor swing and no hit-stop.
  assert.equal(ANIM_SPEEDS.instant, null);
  const fast = fx.slice(fx.indexOf('export function animateEvents'), fx.indexOf('export function groupBeats'));
  assert.doesNotMatch(fast, /hit-stop|hitStopMsFor/, 'the instant path never holds');
});

test('rear reactions tint and knock back in the canvas, not through CSS filters', () => {
  const css = src('styles/combat.css');
  const rear = css.match(/\.player \.sprite\.hitflash > \.alternative-card-stage:not\(\[data-still\]\)[^{]*\{[^}]*\}/)?.[0] || '';
  assert.match(rear, /animation-name: none;/, 'the rear root takes no hit animation');
  assert.doesNotMatch(css, /rear-reaction-flash/, 'the old interpolated rear tint is gone');
  assert.doesNotMatch(rear, /hue-rotate|filter|translate/);
  // A stagger keeps a visible, stepped (never interpolated) tint and no transform.
  assert.match(css, /\.player \.sprite\.wobble:not\(\.hitflash\) > \.alternative-card-stage:first-child,[^{]*\.player \.sprite\.hitflash > \.alternative-card-stage\[data-still\]:first-child[^{]*\{\s*animation-name: rear-stagger-flash;/, 'a still (Rendered) stage keeps a stepped CSS hit tint');
  const stagger = css.match(/@keyframes rear-stagger-flash \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(stagger, /0%, 44\.99% \{ filter: sepia\(1\)/);
  assert.doesNotMatch(stagger, /transform/);
  // A click-skip ends every hit reaction, held by hit-stop or not.
  const fx = src('src/ui/fx.js');
  assert.match(fx, /stageFor\(sprite\)\?\.endReaction\?\.\(\)/);
});

test('enemy hits knock back 22px held through the peak and tint from impact', () => {
  const css = src('styles/combat.css');
  const enemy = css.match(/@keyframes hit-enemy \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(enemy, /translateX\(22px\)/);
  assert.match(enemy, /20%, 45% \{ transform: translateX\(22px\); \}/);
  assert.match(enemy, /0%, 44\.99% \{ filter: sepia\(1\) saturate\(8\) hue-rotate\(315deg\); \}/, 'the tint starts at impact');
  assert.match(css, /@keyframes hit-enemy-heavy \{[\s\S]*?translateX\(34px\)/);
});

test('the CSS pauses a held figure and scales the shake by --shake-px', () => {
  const css = src('styles/combat.css');
  assert.match(css, /^\.hit-stop \{ animation-play-state: paused !important; \}$/m);
  assert.doesNotMatch(css, /\.hit-stop \*/, 'descendant action clips retain their independent clocks');
  assert.match(css, /@keyframes shake \{.*var\(--shake-px, 4px\)/);
});

test('a painted sequence holds: its remaining frames move back by the hold', async () => {
  // reaverAttack's handle and the painted stage both expose hold(ms).
  assert.match(src('src/ui/reaverAttack.js'), /hold\(ms\) \{[\s\S]{0,250}schedule\(Math\.max\(0, due - Date\.now\(\)\) \+ ms\);/);
  assert.match(src('src/ui/paintedOutfits.js'), /hold\(ms\) \{[\s\S]{0,600}due: entry\.due \+ ms/);
  assert.match(src('src/ui/screens/combat.js'), /hold: \(ms\) => \{ if \(fxCtx\.figureAnimations !== false\) stage\?\.hold\?\.\(ms\); \}/);
});

function drive(t, fn, { maxHp } = {}) {
  setCombatPacing({ combatSpeed: 1 });
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 });
  // The scheduler's monotonic clock must advance with these mocked timers.
  t.mock.method(globalThis.performance, 'now', () => Date.now());
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
      onFlush: () => flushes++, onBeatApplied() {}, ...(maxHp ? { maxHpFor: () => maxHp } : {}) };
    const events = (amounts, opener) => [opener || { type: 'enemyMoveStarted', sourceId: 'enemy', kind: 'attack' },
      ...amounts.map((amount) => ({ type: 'damageDealt', sourceId: 'enemy', targetId: 'player', amount }))];
    const start = (amounts, opener) => playTimeline(events(amounts, opener), ctx, () => completed++);
    const fire = (name) => { for (const cb of [...(listeners.get(name) || [])]) cb(); };
    try { fn({ dom, actor, target, combatEl, holds, reactions, buzzes, start, fire,
      tick: (ms) => { for (let i = 0; i < ms; i++) t.mock.timers.tick(1); }, stats: () => ({ flushes, completed, settled }) }); }
    finally { haptic.sink = oldSink; setAnimSpeed('normal'); }
  });
}

test('with Effects off the figure is not held but the timeline spacing is unchanged', (t) => {
  drive(t, ({ dom, start, tick, holds, reactions, stats }) => {
    const timing = actionPacing();
    const reactionAt = timing.intentMs + timing.wordMs + 800 + 120 + timing.afterSpriteMs + timing.resultMs;
    const root = dom.document.documentElement;
    dom.document.documentElement = { dataset: { effects: 'off' } };
    try { start([6, 10]); tick(reactionAt); } finally { dom.document.documentElement = root; }
    assert.deepEqual(holds, [], 'no actor or target hold with Effects off');
    assert.deepEqual(reactions, [['hit', 220]], 'the reaction lands at the same time as with Effects on');
  });
});

test('with Effects on the same contact still holds', (t) => {
  drive(t, ({ start, tick, holds }) => {
    const timing = actionPacing();
    start([6, 10]); tick(timing.intentMs + timing.wordMs + 100);
    assert.equal(holds.length, 1, 'Effects on still holds');
  });
});

// Ordered playback pays both pre-sprite waits, holds the authored contact
// frame for every qualifying hit, then separates reaction and numbers.
test('multi-hit contact holds the attacker and buzzes once with the first number', (t) => {
  drive(t, ({ start, tick, holds, buzzes, reactions }) => {
    const timing = actionPacing();
    const contactAt = timing.intentMs + timing.wordMs + 100;
    const reactionAt = timing.intentMs + timing.wordMs + 800 + 120 + timing.afterSpriteMs + timing.resultMs;
    start([6, 10]); tick(contactAt - 1);
    assert.deepEqual(holds, [], 'no hold before the authored contact frame');
    tick(1);
    assert.deepEqual(holds, [['actor', 120, 10000 + contactAt]], 'both hits extend the contact hold');
    assert.deepEqual(reactions, [], 'the target has not reacted mid-swing');
    assert.deepEqual(buzzes, [], 'no buzz at contact');
    tick(reactionAt - contactAt);
    assert.deepEqual(reactions, [['hit', 220]], 'reaction follows the settled swing and configured wait');
    assert.deepEqual(buzzes, [], 'no buzz at reaction');
    tick(timing.reactionMs);
    assert.deepEqual(buzzes, [['damageTaken', 10000 + reactionAt + timing.reactionMs]], 'buzz comes with the first number');
    tick(5000);
    assert.equal(reactions.length, 2, 'the second hit reacts too');
    assert.ok(holds.every(([who]) => who === 'actor'), 'the target is never held');
    assert.equal(buzzes.length, 1, 'later numbers do not buzz twice');
  });
});

test('skipping after the first multi-hit number does not replay its damage haptic', (t) => {
  drive(t, ({ start, tick, buzzes, fire, stats }) => {
    const timing = actionPacing();
    start([6, 10]);
    tick(timing.intentMs + timing.wordMs + 800 + 120 + timing.afterSpriteMs + timing.resultMs + timing.reactionMs);
    assert.equal(buzzes.length, 1, 'the first number has sounded');
    fire('pointerdown'); fire('pointerup'); tick(1000);
    assert.equal(buzzes.length, 1, 'flushing the remaining hit cannot buzz this beat again');
    assert.equal(stats().completed, 1);
    assert.equal(stats().flushes, 1);
  });
});

test('beatOrder impact holds both figures at impact, as before', (t) => {
  setBeatOrder('impact');
  try {
    drive(t, ({ start, tick, holds, reactions }) => {
      start([6]); tick(100);
      assert.deepEqual(holds, [['actor', 60, 10100], ['target', 60, 10100]]);
      assert.deepEqual(reactions, [['hit', 220]]);
      for (let i = 0; i < 100; i++) tick(20);
    });
  } finally { setBeatOrder('sequential'); }
});

for (const [amount, ms, px] of [[35, 120, '10px'], [6, 60, '2px']]) {
  test(`with the target max HP 100 known, a ${amount} HP hit holds ${ms} ms and shakes ${px}`, (t) => {
    setBeatOrder('impact');
    try {
      drive(t, ({ start, tick, holds, combatEl }) => {
        const shakes = [];
        const setProperty = combatEl.style.setProperty.bind(combatEl.style);
        combatEl.style.setProperty = (name, value) => { if (name === '--shake-px') shakes.push(value); return setProperty(name, value); };
        start([amount]); tick(100);
        assert.deepEqual(holds, [['actor', ms, 10100], ['target', ms, 10100]]);
        for (let i = 0; i < 100; i++) tick(20);
        assert.deepEqual(shakes, [px]);
      }, { maxHp: 100 });
    } finally { setBeatOrder('sequential'); }
  });
}

test('a click during hit-stop clears the held attacker and flushes once without a second buzz', (t) => {
  drive(t, ({ start, tick, actor, target, fire, stats, buzzes }) => {
    start([6]); tick(actionPacing().intentMs + actionPacing().wordMs + 100);
    assert.ok(actor.classList.contains('hit-stop'), 'the attacker holds at impact');
    assert.ok(!target.classList.contains('hit-stop'), 'the target is not held at impact (sequential)');
    fire('pointerdown');
    assert.ok(!actor.classList.contains('hit-stop'));
    assert.ok(!target.classList.contains('hit-stop'));
    assert.equal(stats().settled, 0, "the target was never held at contact, so the skip has no recoil to release");
    fire('pointerup'); tick(1);
    assert.equal(stats().flushes, 1);
    assert.equal(stats().completed, 1);
    assert.equal(buzzes.length, 1);
  });
});

test('an ordered counter holds its attacker on a qualifying HP hit', (t) => {
  drive(t, ({ start, tick, holds }) => {
    start([6], { type: 'combatCounterTriggered', sourceId: 'enemy', targetId: 'player' });
    const contactAt = actionPacing().intentMs + actionPacing().wordMs + 100; tick(contactAt);
    assert.deepEqual(holds, [['actor', 60, 10000 + contactAt]], 'a counter holds contact before its separate target reaction');
    for (let i = 0; i < 100; i++) tick(20);
  });
});

test('a counter beat does not hold on an HP hit under 6', (t) => {
  drive(t, ({ start, tick, holds }) => {
    start([5], { type: 'combatCounterTriggered', sourceId: 'enemy', targetId: 'player' });
    tick(actionPacing().intentMs + actionPacing().wordMs + 100);
    assert.equal(holds.length, 0, 'a counter hit of 5 HP does not hold');
    for (let i = 0; i < 100; i++) tick(20);
  });
});

for (const mode of ['instant', 'reduced-motion', 'no-shake']) {
  test(`${mode} applies its own effect suppression`, (t) => {
    drive(t, ({ dom, start, tick, holds, combatEl }) => {
      if (mode === 'instant') setAnimSpeed('instant');
      else dom.document.body.classList.add(mode);
      start([6]); tick(mode === 'instant' || mode === 'reduced-motion' ? 1 : actionPacing().intentMs + actionPacing().wordMs + 100);
      // Ordered playback holds only the attacker at contact.
      assert.equal(holds.length, mode === 'no-shake' ? 1 : 0);
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

test('a lite (phone) tier does not drop the shake; only the setting does', () => {
  const main = src('src/main.js');
  assert.match(main, /toggle\('no-shake', settings\.screenShake === false\)/);
  assert.doesNotMatch(main, /toggle\('no-shake'[^)]*quality/);
});

test('a damage float sizes by its share of the target max HP; no max HP keeps the absolute tiers', () => {
  assert.equal(dmgClass(35, 100), 'dmg pct35');
  assert.equal(dmgClass(20, 100), 'dmg pct20');
  assert.equal(dmgClass(19, 100), 'dmg heavy', 'below 20% the absolute tiers apply');
  assert.equal(dmgClass(25, 100), 'dmg crit', 'a crit by absolute size outranks pct20; pct35 outranks crit');
  assert.equal(dmgClass(25, 60), 'dmg pct35');
  assert.equal(dmgClass(5, 100), 'dmg small');
  assert.equal(dmgClass(4, 10), 'dmg pct35', 'a chip that is 40 percent of a small target is a big hit');
  assert.equal(dmgClass(10, 0), 'dmg', 'no max HP known: the absolute rule');
  assert.equal(guardHitFloatParts({ amount: 30, blocked: 0 }, 60).damage.cls, 'dmg pct35');
  assert.equal(guardHitFloatParts({ amount: 30, blocked: 18 }, 60).damage.cls, 'dmg pct20', 'the share is of the HP residual the number shows');
  const css = src('styles/combat.css');
  assert.match(css, /\.float-num\.pct20 \{ --pop: 1\.6; font-size: 3\.6rem; \}/);
  assert.match(css, /\.float-num\.pct35 \{ --pop: 1\.9; font-size: 4\.6rem; \}/);
});



test('ordered delayed Reaver contact preserves every timer-driven frame and its hold', t => {
  drive(t, ({ dom, actor, tick }) => {
    const figure = dom.document.createElement('div'); figure.className = 'class-sprite'; actor.appendChild(figure);
    const query = actor.querySelector.bind(actor);
    actor.querySelector = selector => selector === ':scope > .class-sprite' ? figure : query(selector);
    const timing = { frameMs: 20, impactMs: 40, totalMs: REAVER_ATTACK.frameCount * 20 };
    let sequence, image, done = 0, watchdog = 0, contactAt;
    runActionTimeline([{ actorId: 'player', kind: 'attack', events: [] }], {
      maxSpriteMs: () => timing.totalMs,
      onSprite() { sequence = playReaverAttack(actor, timing); image = actor.children.at(-1); return sequence; },
      onContact() { contactAt = Date.now(); sequence.hold(60); return 60; },
      onDone() { done++; },
      onWatchdog() { watchdog++; },
    }, {});
    t.mock.timers.tick(0); // Start the actual painted actor on time.
    t.mock.timers.tick(300); // One frame callback and contact arrive late together.
    assert.equal(contactAt, 10300);
    assert.equal(image.dataset.frameId, 'P02', 'a delayed timer advances one authored frame');
    const remaining = (REAVER_ATTACK.frameCount - 1) * timing.frameMs + 60;
    const reportedRemaining = sequence.remainingMs?.();
    tick(remaining - 1);
    assert.equal(done, 0, 'the timeline keeps the actor until its final frame finishes');
    assert.equal(reportedRemaining, remaining, 'the hold and all unplayed frames remain authoritative');
    assert.equal(image.dataset.frameId, `P${String(REAVER_ATTACK.frameCount).padStart(2, '0')}`);
    tick(1);
    assert.equal(done, 1);
    assert.equal(watchdog, 0);
    assert.equal(figure.hidden, false);
    assert.equal(sequence.remainingMs(), 0, 'cancelled actor reports no pending recovery');
    sequence.cancel(); tick(100);
    assert.equal(done, 1);
  });
});


test('an exhausted Reaver sequence reports zero remaining duration before restoration', t => {
  drive(t, ({ dom, actor, tick }) => {
    const figure = dom.document.createElement('div'); figure.className = 'class-sprite'; actor.appendChild(figure);
    const query = actor.querySelector.bind(actor);
    actor.querySelector = selector => selector === ':scope > .class-sprite' ? figure : query(selector);
    const timing = { frameMs: 20, impactMs: 40, totalMs: REAVER_ATTACK.frameCount * 20 };
    const sequence = playReaverAttack(actor, timing);
    assert.equal(sequence.remainingMs(), timing.totalMs);
    tick(timing.totalMs);
    assert.equal(sequence.remainingMs(), 0, 'no authored frame time remains after exhaustion');
    sequence.cancel();
    assert.equal(sequence.remainingMs(), 0);
    assert.equal(figure.hidden, false);
  });
});
