import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { playTimeline, setAnimSpeed, setBeatOrder, ANIM_SPEEDS } from '../src/ui/fx.js';
import { registerStage } from '../src/ui/services/PoseAnimator.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { selectedWeaponSequence, selectedWeaponSequenceTiming } from '../src/model/selectedWeaponSequences.js';

// Execute the shipped screen handler with instrumented presentation services.
// This exercises its real disabled handle rather than supplying a test handle.
const screen = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const begin = screen.indexOf('  function playFamilyAnimation(');
const end = screen.indexOf('\n\n  let selected =', begin);
assert.ok(begin > 0 && end > begin);
function actionHandler(ctx, calls) {
  return runInNewContext('(' + screen.slice(begin, end).trim() + ')', {
    fxCtx: ctx, combat: { player: { id: 'player' } }, COMBAT_TIMING: { windupFraction: 0.4 },
    combatEffectTargetIds: () => [], presentationTargetIds: () => [], anchorLocalBox: () => ({}),
    playCombatEffectPlan: () => { calls.push('effect'); return () => calls.push('cancel-effect'); },
  });
}

function instrumentStage(anchor, calls) {
  anchor.style.getPropertyPriority ||= () => '';
  return {
    ownsMotion: true, poses: ['smash'],
    actionTiming: (_pose, speed) => selectedWeaponSequenceTiming(selectedWeaponSequence('smash'), speed),
    play: pose => { calls.push(`play:${pose}`); return true; },
    hold: () => calls.push('hold'), settle: () => calls.push('settle'),
  };
}

test('disabled action handles preserve authored weighted timing and cancel effects without sprite or CSS playback', () => {
  withKitDom(dom => {
    for (const enabled of [true, false]) {
      const actor = dom.document.createElement('div'), calls = [];
      const stage = instrumentStage(actor, calls);
      const ctx = { figureAnimations: enabled, anchorFor: () => actor };
      const run = actionHandler(ctx, calls);
      const handle = run(actor, stage, { family: 'strike', pose: 'smash' }, ANIM_SPEEDS.normal, true);
      const timing = selectedWeaponSequenceTiming(selectedWeaponSequence('smash'), ANIM_SPEEDS.normal);
      assert.equal(handle.totalMs, timing.totalMs);
      assert.equal(handle.impactMs, timing.impactMs);
      assert.equal(typeof handle.cancel, 'function');
      assert.equal(actor.classList.contains('enemy-attack-pose'), enabled);
      handle.hold(60); handle.cancel();
      assert.deepEqual(calls, enabled ? ['effect', 'play:smash', 'hold', 'cancel-effect', 'settle'] : ['effect', 'cancel-effect']);
      assert.equal(actor.classList.contains('enemy-attack-pose'), false);
    }
  });
});

function timeline(t, enabled, { fallback = false, lethal = false, cancel = false } = {}) {
  const trace = [];
  withKitDom((dom, win) => {
    const at = what => trace.push({ what, at: Date.now() });
    const anchors = Object.fromEntries(['player', 'e1'].map(id => [id, dom.document.createElement('div')]));
    const ctx = { figureAnimations: enabled, layer: dom.document.createElement('div'), combatEl: dom.document.createElement('div'), anchorFor: id => anchors[id], onBeatApplied: () => at('applied'), onFlush: () => at('flush') };
    const calls = [];
    const actorStage = instrumentStage(anchors.player, calls);
    registerStage(anchors.player, { ...actorStage, play: pose => { at(`actor:${pose}`); return true; } });
    registerStage(anchors.e1, { play: pose => { at(`target:${pose}`); return true; }, hold() {}, settle() {} });
    const action = actionHandler(ctx, calls);
    if (!fallback) ctx.animateActor = (_beat, actor, speed) => action(actor, { ...actorStage, play: pose => { at(`actor:${pose}`); return true; } }, { family: 'strike', pose: 'smash' }, speed);
    const append = ctx.layer.appendChild.bind(ctx.layer);
    ctx.layer.appendChild = node => { if (String(node.className).includes('fx-slash')) at('contact'); if (String(node.className).includes('float-num')) at(`number:${node.textContent}`); return append(node); };
    const events = [
      { type: 'cardPlayed', cardType: 'attack', cardId: 's', cardInstanceId: 'c', targetId: 'e1' },
      { type: 'damageDealt', sourceId: 'player', targetId: 'e1', amount: 3, blocked: 0 },
      ...(lethal ? [{ type: 'enemyDied', targetId: 'e1' }] : []),
    ];
    playTimeline(events, ctx, () => at('done'));
    if (cancel) { win.dispatchEvent({ type: 'pointerdown' }); win.dispatchEvent({ type: 'pointerup' }); }
    for (let i = 0; i < 4000 && !trace.some(row => row.what === 'done'); i++) t.mock.timers.tick(1);
    assert.equal(trace.filter(row => row.what === 'done').length, 1);
    if (!enabled) assert.equal(anchors.player.classList.contains('act-attack'), false);
    if (cancel && !fallback) assert.ok(calls.includes('cancel-effect'), 'cancellation releases the effect handle');
  });
  return trace;
}

for (const order of ['impact', 'sequential']) test(`on/off keeps contact, numbers and completion clocks under ${order} pacing`, t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  try {
    setAnimSpeed('normal'); setBeatOrder(order);
    const start = Date.now(), on = timeline(t, true).map(row => ({ ...row, at: row.at - start }));
    const offStart = Date.now(), off = timeline(t, false).map(row => ({ ...row, at: row.at - offStart }));
    assert.ok(on.some(row => row.what === 'actor:smash'));
    assert.ok(on.some(row => row.what === 'target:hit'));
    assert.ok(!off.some(row => /^(actor|target):/.test(row.what)), 'no authored figure clip runs');
    assert.deepEqual(off, on.filter(row => !/^(actor|target):/.test(row.what)));
    assert.equal(off.find(row => row.what === 'contact').at, selectedWeaponSequenceTiming(selectedWeaponSequence('smash'), ANIM_SPEEDS.normal).impactMs);
  } finally { setAnimSpeed('normal'); setBeatOrder('sequential'); }
});

test('disabled FX fallback cannot start CSS/action poses; defeated drawing remains and cancel completes', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  try {
    setAnimSpeed('normal');
    const trace = timeline(t, false, { fallback: true, lethal: true });
    assert.ok(trace.some(row => row.what === 'target:defeated'));
    assert.ok(!trace.some(row => row.what.startsWith('actor:') || row.what === 'target:hit'));
    timeline(t, false, { cancel: true });
  } finally { setAnimSpeed('normal'); setBeatOrder('sequential'); }
});
