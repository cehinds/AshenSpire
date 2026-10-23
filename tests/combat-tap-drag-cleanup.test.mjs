import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { finishCardDrag } from '../src/ui/cardDragEnd.js';

// Exercise the screen's actual teardown and the shared drag-end decision.
// A fixture supplies DOM effects, not a replacement cleanup decision.
const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const begin = source.indexOf('          teardown: () => {');
const end = source.indexOf('          overHand:', begin);
assert.ok(begin >= 0 && end > begin);
const teardownSource = source.slice(begin, end).trim().replace(/^teardown: /, '').replace(/,$/, '');
function fixture(dragging, ghost = dragging) {
  const effects = [];
  const scope = { dragging, dragGhost: ghost ? { remove: () => effects.push('ghost') } : null,
    clearDragTargeting: () => effects.push('targets'), el: { classList: { remove: name => effects.push(name) } } };
  const teardown = runInNewContext(`(${teardownSource})`, scope);
  const finish = (cancelled = false, overHand = false) => finishCardDrag({}, { cancelled }, {
    teardown, overHand: () => overHand, reorder: () => effects.push('reorder'),
    dropPlan: () => { effects.push('plan'); return { legal: true, targetId: 'e1' }; },
    play: id => effects.push(`play:${id}`),
  });
  return { effects, scope, finish };
}

// Hold/target semantics are exercised by their owner suites and native QA;
// this seam proves only that a gesture which never dragged leaves them alone.
for (const cancelled of [false, true]) {
  test(`non-drag ${cancelled ? 'cancellation' : 'release'} does not clear aims or repaint drag targeting`, () => {
    const f = fixture(false);
    assert.equal(f.finish(cancelled), 'click');
    assert.deepEqual(f.effects, ['drag-source']);
    assert.equal(f.scope.dragging, false);
  });
}

test('a real legal drag restores targeting before planning and playing its captured destination', () => {
  const f = fixture(true);
  assert.equal(f.finish(), 'played');
  assert.deepEqual(f.effects, ['targets', 'drag-source', 'ghost', 'plan', 'play:e1']);
  assert.equal(f.scope.dragging, false); assert.equal(f.scope.dragGhost, null);
});

test('cancelled drags clean targeting and ghost but never plan, reorder or play', () => {
  const f = fixture(true);
  assert.equal(f.finish(true), 'cancelled');
  assert.deepEqual(f.effects, ['targets', 'drag-source', 'ghost']);
  assert.equal(f.scope.dragging, false); assert.equal(f.scope.dragGhost, null);
});

test('a hand reorder still cleans drag visuals before moving its card', () => {
  const f = fixture(true);
  assert.equal(f.finish(false, true), 'reorder');
  assert.deepEqual(f.effects, ['targets', 'drag-source', 'ghost', 'reorder']);
});
