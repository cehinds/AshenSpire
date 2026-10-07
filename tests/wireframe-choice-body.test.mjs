import test from 'node:test';
import assert from 'node:assert/strict';
import { choiceBodyFrameVars, restChoiceStatus, eventResponseStatus } from '../src/ui/models/ChoiceBodyModel.js';
import { wireframeUi } from '../src/content/wireframeUi.js';

test('the frame resolves the W1 shares as zoom-divided viewport lengths', () => {
  const vars = choiceBodyFrameVars();
  assert.equal(vars['--choice-frame-width'], 'calc(95vw / var(--ui-zoom, 1))');
  assert.equal(vars['--choice-frame-height'], 'calc(90vh / var(--ui-zoom, 1))');
  assert.equal(vars['--choice-outer-x'], 'calc(2.5vw / var(--ui-zoom, 1))');
  assert.equal(vars['--choice-outer-y'], 'calc(5vh / var(--ui-zoom, 1))');
  assert.equal(vars['--choice-head-min'], 'calc(10vh / var(--ui-zoom, 1))');
  assert.equal(vars['--choice-column-gap'], 'calc(2vw / var(--ui-zoom, 1))');
  assert.equal(vars['--choice-row-gap'], 'calc(2vh / var(--ui-zoom, 1))');
  assert.ok(Object.isFrozen(vars) && Object.isFrozen(wireframeUi.choiceBody));
});

test('bad frame numbers fail loud instead of painting a broken frame', () => {
  assert.throws(() => choiceBodyFrameVars({ ...wireframeUi.choiceBody, frameWidthVw: Number.NaN }), /frameWidthVw/);
  assert.throws(() => choiceBodyFrameVars({ ...wireframeUi.choiceBody, frameHeightVh: 120 }), /exceed/);
});

test('rest counts available, closed and used choices separately', () => {
  const status = restChoiceStatus([
    { id: 'rest', available: true },
    { id: 'smith', available: false },
    { id: 'flask', available: true },
    { id: 'level', available: false },
  ]);
  assert.deepEqual(status.rows.map((row) => [row.id, row.state]), [['rest', 'available'], ['smith', 'unavailable'], ['flask', 'available'], ['level', 'unavailable']]);
  assert.deepEqual([status.total, status.available, status.unavailable, status.used], [4, 2, 2, 0]);
  assert.ok(Object.isFrozen(status) && Object.isFrozen(status.rows[0]));
});

test('a rest already taken under multi-use reads used, not closed', () => {
  const status = restChoiceStatus([{ id: 'rest', available: false, used: true }, { id: 'smith', available: true }]);
  assert.deepEqual(status.rows.map((row) => row.state), ['used', 'available']);
  assert.deepEqual([status.available, status.unavailable, status.used], [1, 0, 1]);
  assert.equal(restChoiceStatus().total, 0);
});

test('an event is choose, limited by a price, or resolved', () => {
  const open = eventResponseStatus([{ index: 0, affordable: true }, { index: 1, affordable: true, binding: true }, { index: 2, affordable: true }]);
  assert.deepEqual([open.phase, open.total, open.available, open.blocked, open.binding, open.continueAllowed], ['choose', 3, 3, 0, 1, false]);
  const priced = eventResponseStatus([{ index: 0, affordable: false, priced: true }, { index: 1, affordable: true }]);
  assert.deepEqual([priced.phase, priced.available, priced.blocked], ['limited', 1, 1]);
  assert.deepEqual(priced.rows[0], { index: 0, state: 'blocked', priced: true, binding: false });
  const done = eventResponseStatus([{ index: 0, affordable: true }], { resolved: true });
  assert.deepEqual([done.phase, done.continueAllowed], ['resolved', true]);
});
