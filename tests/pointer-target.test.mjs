import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { pointerTargetExpression } from '../tools/pointer-target.mjs';

function fixture(hitAt, rect = { x: 20, y: 20, width: 100, height: 100 }) {
  const target = { scrollIntoView() {}, getBoundingClientRect: () => rect,
    contains: el => [target, art, nested].includes(el), closest: () => target };
  const art = { closest: () => target };
  const nested = { closest: () => nested };
  const blocker = { closest: () => null };
  const context = { innerWidth: 200, innerHeight: 200,
    document: { querySelector: () => target, elementFromPoint: (x,y) => hitAt({ target, art, nested, blocker }, x,y) } };
  return () => JSON.parse(JSON.stringify(runInNewContext(pointerTargetExpression('.target'), context)));
}

test('pointer target preserves the center of an ordinary control', () => {
  assert.deepEqual(fixture(({target}) => target)(), { x:70, y:70 });
});
test('pointer target avoids nested intent controls and a neighbouring actor', () => {
  const run = fixture(({nested, blocker, art}, x) => x === 70 ? nested : x === 45 ? blocker : art);
  assert.deepEqual(run(), { x:95, y:70 });
});
test('pointer target uses a formation actor published hit centre before its covered wrapper', () => {
  const probe = formationFixture(({target, blocker}, x, y) => x === 56 && y === 116 ? target : blocker,
    { zoom: 1.2, originY: 20, localHeight: 100, targetStyle: { left: '30px', top: '80px' } });
  assert.deepEqual(probe.run(), { x:56, y:116 });
  assert.deepEqual(probe.samples, [{ x:56, y:116 }]);
});
test('pointer target refuses a wholly covered or offscreen control', () => {
  assert.throws(fixture(({blocker}) => blocker), /no unobstructed/);
  assert.throws(fixture(({target}) => target, {x:250,y:250,width:100,height:100}), /no unobstructed/);
});

function formationFixture(hitAt, { zoom = 1, originY = 10, localHeight = 400, targetStyle = {} } = {}) {
  const rect = { x: 20, y: originY, width: 100 * zoom, height: localHeight * zoom };
  const core = { x: 20 + parseFloat(targetStyle.left ?? '70') * zoom, y: originY + parseFloat(targetStyle.top ?? '333') * zoom };
  const samples = [];
  const target = { scrollIntoView() {}, getBoundingClientRect: () => rect,
    matches: () => true, offsetWidth: 100,
    contains: el => [target, art, nested].includes(el), closest: () => target };
  const art = { closest: () => target }, nested = { closest: () => nested }, blocker = { closest: () => null };
  const style = { left: '70px', top: '333px', width: `${104 / zoom}px`, height: `${44 / zoom}px`,
    content: '""', display: 'block', visibility: 'visible', pointerEvents: 'auto', ...targetStyle };
  const context = { innerWidth: 700, innerHeight: 900,
    getComputedStyle: (_el, pseudo) => pseudo === '::after' ? style : { width: '100px' },
    document: { querySelector: () => target, elementFromPoint: (x, y) => {
      samples.push({ x, y }); return hitAt({ target, art, nested, blocker, core, rect }, x, y);
    } } };
  return { core, rect, samples, run: () => JSON.parse(JSON.stringify(runInNewContext(pointerTargetExpression('.combatant.player.armed'), context))) };
}

test('formation sampling reaches its independently fitted 44px core before the old frame grid', () => {
  const probe = formationFixture(({ target, blocker, core }, x, y) =>
    Math.abs(x - core.x) < 22 && Math.abs(y - core.y) < 22 ? target : blocker);
  assert.deepEqual(probe.run(), probe.core);
  assert.deepEqual(probe.samples, [probe.core], 'the first point is the actual fitted target, not the tall frame center');
  const oldGrid = [0.5, 0.75, 0.25, 0.9, 0.1].flatMap(fy => [0.5, 0.25, 0.75].map(fx =>
    ({ x: probe.rect.x + probe.rect.width * fx, y: probe.rect.y + probe.rect.height * fy })));
  assert.ok(oldGrid.every(({ x, y }) => Math.abs(x - probe.core.x) >= 22 || Math.abs(y - probe.core.y) >= 22),
    'this placement genuinely defeats all original 15 points');
});

test('formation target coordinates account for CSS zoom without scaling the physical core twice', () => {
  for (const zoom of [.67, .738, 1, 1.5]) {
    const probe = formationFixture(({ target, blocker, core }, x, y) =>
      x === core.x && y === core.y ? target : blocker, { zoom });
    assert.deepEqual(probe.run(), probe.core);
  }
});

test('a covered or nested formation core does not bypass hit testing or remove any of the original 15 candidates', () => {
  for (const obstruction of ['blocker', 'nested']) {
    const probe = formationFixture((nodes) => nodes[obstruction]);
    assert.throws(probe.run, /no unobstructed/);
    assert.equal(probe.samples.length, 30, '15 core probes followed by all 15 original frame probes');
    const expected = [0.5, 0.75, 0.25, 0.9, 0.1].flatMap(fy => [0.5, 0.25, 0.75].map(fx =>
      ({ x: probe.rect.x + probe.rect.width * fx, y: probe.rect.y + probe.rect.height * fy })));
    assert.deepEqual(probe.samples.slice(15), expected, 'original frame coordinates and order are retained');
  }
});

test('formation core rejects a nested reading control while accepting another genuinely owned point', () => {
  const probe = formationFixture(({ nested, target, blocker, core }, x, y) => {
    if (x === core.x && y === core.y) return nested;
    if (x === core.x - 11 && y === core.y) return target;
    return blocker;
  });
  assert.deepEqual(probe.run(), { x: probe.core.x - 11, y: probe.core.y });
});

test('unpainted or invalid formation pseudo geometry retains the original ordinary-grid behavior', () => {
  for (const targetStyle of [{ display: 'none' }, { visibility: 'hidden' }, { pointerEvents: 'none' },
    { content: 'none' }, { left: 'auto' }, { height: '0px' }]) {
    const probe = formationFixture(({ target }) => target, { targetStyle });
    assert.deepEqual(probe.run(), { x: 70, y: 210 });
    assert.equal(probe.samples.length, 1);
  }
});

test('offscreen fitted-core points are never sent to native hit testing', () => {
  const probe = formationFixture(({ target }) => target, { targetStyle: { left: '1000px' } });
  assert.deepEqual(probe.run(), { x: 70, y: 210 });
  assert.deepEqual(probe.samples, [{ x: 70, y: 210 }], 'only the first in-viewport original frame point was tested');
});
