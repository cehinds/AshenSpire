import test from 'node:test';
import assert from 'node:assert/strict';
import { syncCoreTinyTarget } from '../src/ui/components/battlefieldStage.js';

function frame() {
  const values = new Map();
  return { dataset: {}, style: { setProperty: (key, value) => values.set(key, value), removeProperty: key => values.delete(key) }, values };
}
const art = (width, height) => ({ left: 100, right: 100 + width, top: 160, bottom: 160 + height });

test('tiny Core actors have a physical44px target at their measured painted center at every zoom', () => {
  for (const zoom of [.5, .83, 1, 1.5, 2]) for (const [width, height] of [[16,16], [16,80], [80,16]]) {
    const target = frame(), painted = art(width, height), before = structuredClone(painted);
    assert.equal(syncCoreTinyTarget(target, painted, { left:80, top:120 }, zoom), true);
    const n = key => parseFloat(target.values.get(key)) * zoom;
    assert.equal(n('--enemy-hit-width'), 44);
    assert.equal(n('--enemy-hit-height'), 44);
    assert.equal(n('--enemy-hit-x') + 80, 100 + width / 2);
    assert.equal(n('--enemy-hit-y') + 120, 160 + height / 2);
    assert.equal(target.dataset.coreTinyTarget, 'true');
    assert.deepEqual(painted, before, 'target enlargement never changes painted geometry');
  }
});

test('returning to normal art clears the tiny target instead of leaving a stale proxy', () => {
  const target = frame();
  assert.equal(syncCoreTinyTarget(target, art(16,16), {left:80,top:120}, .83), true);
  assert.equal(syncCoreTinyTarget(target, art(24,24), {left:80,top:120}, .83), false);
  assert.equal(target.values.size, 0);
  assert.equal(target.dataset.coreTinyTarget, undefined);
  for (const [painted, zoom] of [[art(0,16),1], [art(16,0),1], [art(16,16),0], [{...art(16,16),top:NaN},1]]) {
    assert.equal(syncCoreTinyTarget(target, painted, {left:80,top:120}, zoom), false);
    assert.equal(target.values.size, 0, 'unmeasured geometry never enables a proxy');
  }
});
