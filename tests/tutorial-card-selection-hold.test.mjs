import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source = readFileSync(new URL('../tools/tutorial-reach.mjs', import.meta.url), 'utf8');
const until = source.slice(source.indexOf('  const until ='), source.indexOf('  const clickAt ='));
const hold = source.slice(source.indexOf('  const holdCardToSelect ='), source.indexOf('  const pressKey ='));
const unarmedSelector = '.enemy-row .enemy.targetable, .combatant.player.armed';

function fixture(targetSelector, {missing = false, alreadyArmed = false} = {}) {
  let now = 0, pressed = false, armed = alreadyArmed;
  const makeCard = (hold, selected) => ({dataset: {hold}, classList: {contains: name => name === 'selected' && selected}});
  let card = makeCard('idle', false);
  const events = [], observed = [];
  const document = {querySelector: selector => {
    if (selector === unarmedSelector || selector === targetSelector) return armed ? {} : null;
    return !missing && selector === '.hand .card[data-instance-id="intended"]' ? card : null;
  }};
  const context = {
    S: 'session', Date: {now: () => now},
    cdp: {send: async (method, event) => {
      assert.equal(method, 'Input.dispatchMouseEvent');
      events.push(event.type);
      pressed = event.type === 'mousePressed';
      // Inspection lights a card at hold start without arming a target.
      if (pressed) card = makeCard('holding', true);
    }},
    evalIn: expression => runInNewContext(expression, {document}),
    wait: async ms => {
      now += ms;
      if (!pressed) return;
      observed.push({pressed, hold: card.dataset.hold, selected: card.classList.contains('selected'), armed});
      // Completion repaints the hand: the old done flag is transient, and the
      // replacement has idle fill metadata but durable selection/target state.
      card.dataset.hold = 'done';
      card = makeCard('idle', true);
      armed = true;
    },
  };
  const select = runInNewContext(`${until}\n${hold}\nholdCardToSelect;`, context);
  return {select, events, observed, get pressed() {return pressed;}};
}

for (const target of ['.enemy-row .enemy.targetable', '.combatant.player.armed']) {
  test(`tutorial hold waits through inspection and hand replacement for ${target}`, async () => {
    const f = fixture(target);
    await f.select({x: 30, y: 40, instanceId: 'intended'}, target);
    assert.deepEqual(f.events, ['mousePressed', 'mouseReleased']);
    assert.deepEqual(f.observed, [{pressed: true, hold: 'holding', selected: true, armed: false}]);
    assert.equal(f.pressed, false);
  });
}

test('tutorial selection releases the native pointer when the intended card never appears', async () => {
  const target = '.combatant.player.armed', f = fixture(target, {missing: true});
  await assert.rejects(f.select({x: 30, y: 40, instanceId: 'intended'}, target), /timeout: completed selection hold for intended/);
  assert.deepEqual(f.events, ['mousePressed', 'mouseReleased']);
  assert.equal(f.pressed, false);
});

test('tutorial selection refuses a pre-existing armed target before sending pointer input', async () => {
  const target = '.combatant.player.armed', f = fixture(target, {alreadyArmed: true});
  await assert.rejects(f.select({x: 30, y: 40, instanceId: 'intended'}, target), /requires an unarmed board/);
  assert.deepEqual(f.events, []);
});
