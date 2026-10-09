import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { pointerTargetExpression } from '../tools/pointer-target.mjs';

function fixture(hitAt, rect = { x: 20, y: 20, width: 100, height: 100 }, variables = {}, zoom = 1) {
  const target = { scrollIntoView() {}, getBoundingClientRect: () => rect,
    contains: el => [target, art, nested].includes(el), closest: () => target };
  const art = { closest: () => target };
  const nested = { closest: () => nested };
  const blocker = { closest: () => null };
  const body = {};
  const context = { innerWidth: 200, innerHeight: 200,
    getComputedStyle: el => el === body ? { zoom: String(zoom) } : { getPropertyValue: name => variables[name] || '' },
    document: { body, querySelector: () => target, elementFromPoint: (x,y) => hitAt({ target, art, nested, blocker }, x,y) } };
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
  const run = fixture(({target, blocker}, x, y) => x === 56 && y === 116 ? target : blocker,
    { x:20, y:20, width:100, height:100 }, { '--enemy-hit-x':'30px', '--enemy-hit-y':'80px' }, 1.2);
  assert.deepEqual(run(), { x:56, y:116 });
});
test('pointer target refuses a wholly covered or offscreen control', () => {
  assert.throws(fixture(({blocker}) => blocker), /no unobstructed/);
  assert.throws(fixture(({target}) => target, {x:250,y:250,width:100,height:100}), /no unobstructed/);
});
