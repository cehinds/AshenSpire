import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { withKitDom } from './helpers/kit-dom.mjs';
import { armHold } from '../src/ui/components/holdconfirm.js';
import { canRestoreEnemyHoldCard, enemyHoldActionStep, enemyHoldPlayReason } from '../src/ui/models/EnemyHoldActionModel.js';
import { t, tFull } from '../src/ui/strings.js';

function harness(run, { tapOnPointerRelease = true } = {}) {
  withKitDom((dom) => {
    const frame = dom.document.createElement('article');
    frame.setAttribute('role', 'button');
    const sprite = dom.document.createElement('div');
    sprite.className = 'sprite';
    const nested = dom.document.createElement('button');
    nested.className = 'intent';
    sprite.appendChild(nested);
    frame.appendChild(sprite);
    dom.document.body.appendChild(frame);
    let confirms = 0;
    let taps = 0;
    let frameClicks = 0;
    let animation = null;
    const realRaf = globalThis.requestAnimationFrame;
    const realCancel = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = callback => { animation = callback; return 1; };
    globalThis.cancelAnimationFrame = () => { animation = null; };
    const accepted = event => event.target === frame || (sprite.contains(event.target) && event.target !== nested);
    const disarm = armHold(frame, {
      id: 'enemy-actions', ms: 30, stopImmediateClick: true,
      shouldBegin: origin => accepted(origin.ev),
      onTap: event => { if (accepted(event)) { taps += 1; event.stopImmediatePropagation(); } },
      onConfirm: event => { if (accepted(event)) confirms += 1; },
      tapOnEarlyRelease: true, tapOnPointerRelease,
    });
    frame.addEventListener('click', () => { frameClicks += 1; });
    const dispatch = (target, type, options = {}) => target.dispatchEvent(new dom.Event(type, { bubbles: true, pointerId: 1, ...options }));
    try { run({ dom, frame, sprite, nested, dispatch, counts: () => ({ confirms, taps, frameClicks }), fireHold: () => animation?.(1e9), disarm }); }
    finally {
      disarm();
      globalThis.requestAnimationFrame = realRaf;
      globalThis.cancelAnimationFrame = realCancel;
    }
  });
}

test('enemy frame hold consumes its trailing click, including same-node listeners', () => {
  for (const detail of [1, 0]) harness(({ dom, frame, dispatch, counts, fireHold }) => {
      dispatch(frame, 'pointerdown', { clientX: 1, clientY: 1 });
      fireHold();
      const up = new dom.Event('pointerup', { pointerId: 1, bubbles: true });
      up.target = frame;
      globalThis.window.dispatchEvent(up);
      dispatch(frame, 'click', { detail });
      assert.deepEqual(counts(), { confirms: 1, taps: 0, frameClicks: 0 });
    });
});

test('enemy frame short tap routes once and preserves the following click boundary', () => {
  harness(({ dom, frame, dispatch, counts }) => {
    dispatch(frame, 'pointerdown', { clientX: 1, clientY: 1 });
    const up = new dom.Event('pointerup', { pointerId: 1, bubbles: true });
    up.target = frame;
    globalThis.window.dispatchEvent(up);
    dispatch(frame, 'click', { detail: 1 });
    assert.deepEqual(counts(), { confirms: 0, taps: 1, frameClicks: 0 });
  });
});

test('immediate-click option still delivers tap once when release delivery is disabled', () => {
  for (const detail of [1, 0]) harness(({ dom, frame, dispatch, counts }) => {
    dispatch(frame, 'pointerdown', { clientX: 1, clientY: 1 });
    const up = new dom.Event('pointerup', { pointerId: 1, bubbles: true });
    up.target = frame;
    globalThis.window.dispatchEvent(up);
    dispatch(frame, 'click', { detail });
    assert.deepEqual(counts(), { confirms: 0, taps: 1, frameClicks: 0 });
  }, { tapOnPointerRelease: false });
});

test('nested intent controls decline the hold and keep their ordinary click route', () => {
  harness(({ dispatch, nested, counts }) => {
    dispatch(nested, 'pointerdown', { clientX: 1, clientY: 1 });
    dispatch(nested, 'click', { detail: 1 });
    assert.deepEqual(counts(), { confirms: 0, taps: 0, frameClicks: 1 });
  });
});

test('moving off the enemy frame cancels the hold and consumes its synthetic click', () => {
  harness(({ dom, frame, dispatch, counts }) => {
    dispatch(frame, 'pointerdown', { clientX: 1, clientY: 1 });
    const move = new dom.Event('pointermove', { pointerId: 1, clientX: 90, clientY: 1 });
    globalThis.window.dispatchEvent(move);
    const up = new dom.Event('pointerup', { pointerId: 1, bubbles: true });
    up.target = frame;
    globalThis.window.dispatchEvent(up);
    dispatch(frame, 'click', { detail: 1 });
    assert.deepEqual(counts(), { confirms: 0, taps: 0, frameClicks: 0 });
  });
});

test('focused keyboard and gamepad presses share enemy tap, hold, and cancel behavior', () => {
  for (const source of ['key', 'pad']) {
    harness(({ dom, frame, counts, fireHold }) => {
      const press = new dom.Event('gppress', { bubbles: true, detail: { source } });
      frame.dispatchEvent(press);
      const release = new dom.Event('gprelease', { bubbles: true, detail: { source } });
      frame.dispatchEvent(release);
      assert.deepEqual(counts(), { confirms: 0, taps: 1, frameClicks: 0 }, `${source} short press routes tap`);
    });

    harness(({ dom, frame, counts, fireHold }) => {
      frame.dispatchEvent(new dom.Event('gppress', { bubbles: true, detail: { source } }));
      fireHold();
      frame.dispatchEvent(new dom.Event('gprelease', { bubbles: true, detail: { source } }));
      assert.deepEqual(counts(), { confirms: 1, taps: 0, frameClicks: 0 }, `${source} completed hold confirms once`);
    });

    harness(({ dom, frame, counts, fireHold }) => {
      frame.dispatchEvent(new dom.Event('gppress', { bubbles: true, detail: { source } }));
      frame.dispatchEvent(new dom.Event('gprelease', { bubbles: true, detail: { source, cancelled: true } }));
      fireHold();
      assert.deepEqual(counts(), { confirms: 0, taps: 0, frameClicks: 0 }, `${source} cancelled press has no action`);
    });
  }
});

test('flow opens direct inspection without a card and routes Inspect, Back, Exit and close', () => {
  assert.deepEqual(enemyHoldActionStep('battle', 'hold', { hasCard: false }), { state: 'inspector', effect: 'inspect' });
  let state = enemyHoldActionStep('battle', 'hold', { hasCard: true }).state;
  assert.equal(state, 'chooser');
  state = enemyHoldActionStep(state, 'inspect').state;
  assert.equal(state, 'inspector');
  state = enemyHoldActionStep(state, 'back').state;
  assert.equal(state, 'chooser');
  state = enemyHoldActionStep(state, 'exit').state;
  assert.equal(state, 'closed');
  assert.equal(enemyHoldActionStep(state, 'close').effect, null, 'Escape/header close cannot restart a closed flow');
  assert.deepEqual(enemyHoldActionStep('inspector', 'close'), { state: 'closed', effect: 'close-flow' });
});

test('Play revalidation rejects stale, queued, dead and unaffordable actions, then commits once', () => {
  const base = { active: true, phase: 'player', selectedInstanceId: 'card-1', instanceId: 'card-1',
    enemyAlive: true, actionEnabled: true, legalTarget: true };
  assert.match(enemyHoldPlayReason({ ...base, selectedInstanceId: 'card-2' }), /selected card changed/);
  assert.match(enemyHoldPlayReason({ ...base, queued: true }), /Queued cards/);
  assert.match(enemyHoldPlayReason({ ...base, enemyAlive: false }), /no longer alive/);
  assert.match(enemyHoldPlayReason({ ...base, actionEnabled: false, actionReason: 'Not enough resources.' }), /Not enough resources/);
  assert.match(enemyHoldPlayReason({ ...base, legalTarget: false }), /cannot target/);
  assert.equal(enemyHoldPlayReason(base), '');
  let state = 'chooser';
  assert.equal(enemyHoldActionStep(state, 'play', { playAllowed: false }).state, 'chooser');
  const action = enemyHoldActionStep(state, 'play', { playAllowed: true });
  state = action.state;
  assert.equal(action.effect, 'play');
  assert.equal(enemyHoldActionStep(state, 'play', { playAllowed: true }).effect, null, 'a second Play is ignored after close');
});

test('closing and inspector Back preserve only the captured, still-live selection', () => {
  const base = { instanceId: 'card-1', selectedInstanceId: null, phase: 'player', inHand: true };
  assert.equal(canRestoreEnemyHoldCard(base), true, 'Escape/Exit can restore the original selection');
  assert.equal(canRestoreEnemyHoldCard({ ...base, selfArmInstanceId: 'card-1' }), true, 'a self-armed card keeps its selection mode');
  assert.equal(canRestoreEnemyHoldCard({ ...base, selectedInstanceId: 'card-2' }), false, 'a new selection wins');
  assert.equal(canRestoreEnemyHoldCard({ ...base, superseded: true }), false, 'a cleared newer selection cannot resurrect the old one');
  assert.equal(canRestoreEnemyHoldCard({ ...base, queued: true }), false, 'queued cards are not restored');
  assert.equal(canRestoreEnemyHoldCard({ ...base, inHand: false }), false, 'stale cards are not restored');
  let state = enemyHoldActionStep('battle', 'hold', { hasCard: true }).state;
  state = enemyHoldActionStep(state, 'inspect').state;
  assert.equal(enemyHoldActionStep(state, 'back').state, 'chooser', 'inspector Back retains the flow selection');
  assert.equal(enemyHoldActionStep(state, 'close').state, 'closed', 'inspector Escape closes the full flow');
});

test('combat wires the chooser labels, preservation guard and canonical enemy play', () => {
  const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  assert.match(source, /label: t\('combat\.enemyHold\.inspect'\)/);
  assert.match(source, /label: t\('combat\.reaction\.play'\)/);
  assert.match(source, /label: t\('common\.back'\)/);
  assert.match(source, /label: t\('combat\.enemyHold\.exit'\)/);
  assert.match(source, /function enemyHoldPlayReason\(instanceId, enemyId\)/);
  assert.match(source, /function restoreEnemyHoldCard\(instanceId, selfArmed = false\)/);
  assert.match(source, /heldCardInstanceId = selected \|\| selfArm/);
  assert.match(source, /onConfirm: event => \{\s*if \(!enemyHoldSurface\(event, box\)\) return;/);
  assert.match(source, /isRoundQueued\(instanceId\)/);
  assert.match(source, /cardTargets\(instanceId\)\.legalIds\.includes\(enemyId\)/);
  assert.match(source, /playCard\(instanceId, enemyId\)/);
  assert.match(source, /function disposeEnemyFrame\(record\)/);
  assert.match(source, /if \(enemyHoldPreserveInstance && !enemyHoldFlowSuperseded/);
  assert.match(source, /canRestoreEnemyHoldCard\(/);
  assert.match(source, /frame\.inert = !alive/);
  assert.match(source, /onExit: \(\) => \{[\s\S]*?finishEnemyHoldFlow\(instanceId, selfArmed\);/);
});

test('enemy hold labels and tokenized notes resolve through authored UI strings', () => {
  assert.deepEqual([
    t('combat.enemyHold.inspect'), t('common.back'), t('combat.enemyHold.exit'), t('combat.reaction.play'),
  ], ['Inspect', 'Back', 'Exit', 'Play']);
  assert.equal(tFull('combat.enemyHold.inspectOrPlay', { enemy: 'Imp', card: 'Strike' }), 'Inspect Imp or play Strike on it.');
  assert.equal(tFull('combat.enemyHold.playUnavailable', { card: 'Strike', reason: 'No target' }), 'Play Strike unavailable: No target');
  assert.equal(tFull('combat.enemyHold.closeInspection', { enemy: 'Imp' }), 'Close Imp');
  assert.equal(tFull('combat.enemyHold.closeActions', { enemy: 'Imp' }), 'Close actions for Imp');
});

test('combat hold beat uses its authored synth recipe without probing an absent sample', () => {
  const beat = readFileSync(new URL('../src/ui/components/holdbeat.js', import.meta.url), 'utf8');
  assert.match(beat, /sfx\.play\(id, \{ registeredSamplesOnly: true \}\)/);
});

test('combatant frame Enter yields to captured holds and ignores repeats while Space keeps tap fallback', () => {
  const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  const wiringAt = source.indexOf('function wireCombatantContext(box, subject)');
  const handlerMatch = source.slice(wiringAt).match(/box\.addEventListener\('keydown', event => \{([\s\S]*?)\n\s{4}\}\);/);
  assert.ok(handlerMatch, 'the real combatant keydown callback exists');
  assert.match(handlerMatch[1], /event\.defaultPrevented \|\| event\.repeat/);

  withKitDom((dom) => {
    const box = dom.document.createElement('article');
    let clicks = 0;
    box.addEventListener('click', () => { clicks += 1; });
    new Function('box', `box.addEventListener('keydown', event => {${handlerMatch[1]}\n});`)(box);
    const key = (keyName, { prevented = false, repeat = false } = {}) => {
      const event = new dom.Event('keydown', { bubbles: true, cancelable: true });
      event.key = keyName;
      event.repeat = repeat;
      if (prevented) event.preventDefault();
      box.dispatchEvent(event);
    };
    key('Enter', { prevented: true });
    assert.equal(clicks, 0, 'capture-owned Enter cannot bypass the hold through box.click');
    key('Enter', { repeat: true });
    assert.equal(clicks, 0, 'native Enter repeat cannot create a second tap');
    key('Enter');
    assert.equal(clicks, 1, 'uncaptured Enter retains its compatibility tap path');
    key(' ');
    assert.equal(clicks, 2, 'Space retains its existing tap behavior');
  });
});
