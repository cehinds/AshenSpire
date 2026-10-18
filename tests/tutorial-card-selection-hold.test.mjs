import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source = readFileSync(new URL('../tools/tutorial-reach.mjs', import.meta.url), 'utf8');
const until = source.slice(source.indexOf('  const until ='), source.indexOf('  const clickAt ='));
const hold = source.slice(source.indexOf('  const holdCardToSelect ='), source.indexOf('  const pressKey ='));

function fixture({missing = false} = {}) {
  let now = 0, pressed = false, selected = false, progress = 'holding';
  const events = [], observed = [];
  const card = {dataset: {get hold() {return progress;}}, classList: {contains: name => name === 'selected' && selected}};
  const document = {querySelector: selector => !missing && selector === '.hand .card[data-instance-id="intended"]' ? card : null};
  const context = {
    S: 'session', Date: {now: () => now},
    cdp: {send: async (method, event) => {
      assert.equal(method, 'Input.dispatchMouseEvent');
      events.push(event.type);
      pressed = event.type === 'mousePressed';
    }},
    evalIn: expression => runInNewContext(expression, {document}),
    wait: async ms => {
      now += ms;
      if (!pressed) return;
      observed.push({pressed, progress, selected});
      if (progress === 'holding') progress = 'done';
      else selected = true;
    },
  };
  const select = runInNewContext(`${until}\n${hold}\nholdCardToSelect;`, context);
  return {select, events, observed, get pressed() {return pressed;}};
}

test('tutorial selection keeps the native press down until the intended hold is done and selected', async () => {
  const f = fixture();
  await f.select({x: 30, y: 40, instanceId: 'intended'});
  assert.deepEqual(f.events, ['mousePressed', 'mouseReleased']);
  assert.deepEqual(f.observed, [
    {pressed: true, progress: 'holding', selected: false},
    {pressed: true, progress: 'done', selected: false},
  ]);
  assert.equal(f.pressed, false);
});

test('tutorial selection releases the native pointer when the intended card never completes', async () => {
  const f = fixture({missing: true});
  await assert.rejects(f.select({x: 30, y: 40, instanceId: 'intended'}), /timeout: completed selection hold for intended/);
  assert.deepEqual(f.events, ['mousePressed', 'mouseReleased']);
  assert.equal(f.pressed, false);
});
