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
import { ANIM_SPEEDS } from '../src/ui/fx.js';

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
  assert.match(fx, /const holdMs = beat\.kind === 'attack' \? hitStopMsFor\(hardest\) : 0;/);
  assert.match(fx, /actorAnimation\.totalMs \+ holdMs/, 'the hold lengthens the recovery, so the beat ends after the swing');
  // Instant has no paced timeline: playTimeline falls back to animateEvents,
  // which has no actor swing and no hit-stop.
  assert.equal(ANIM_SPEEDS.instant, null);
  const fast = fx.slice(fx.indexOf('export function animateEvents'), fx.indexOf('export function groupBeats'));
  assert.doesNotMatch(fast, /hit-stop|hitStopMsFor/, 'the instant path never holds');
});

test('the CSS pauses a held figure and scales the shake by --shake-px', () => {
  const css = src('styles/combat.css');
  assert.match(css, /\.hit-stop, \.hit-stop \* \{ animation-play-state: paused !important; \}/);
  assert.match(css, /@keyframes shake \{.*var\(--shake-px, 4px\)/);
});
