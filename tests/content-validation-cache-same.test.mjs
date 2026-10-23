import assert from 'node:assert/strict';
import test from 'node:test';
import { sameContent } from '../src/model/contentValidationCache.js';

test('sameContent compares data deeply and refuses any difference', () => {
  const fn = () => 1;
  const make = () => ({ a: [1, { b: 'x' }], m: new Map([['k', { v: 1 }]]), s: new Set([1, 2]), fn, n: null });
  assert.equal(sameContent(make(), make()), true);
  for (const edit of [x => { x.a[1].b = 'y'; }, x => { x.a.push(2); }, x => { x.m.get('k').v = 2; }, x => { x.s.add(3); }, x => { x.fn = () => 1; }, x => { x.extra = 1; }, x => { delete x.n; }]) {
    const changed = make(); edit(changed);
    assert.equal(sameContent(make(), changed), false);
  }
});

test('sameContent tolerates cycles and tells arrays from objects', () => {
  const a = { name: 'a' }; a.self = a;
  const b = { name: 'a' }; b.self = b;
  assert.equal(sameContent(a, b), true);
  assert.equal(sameContent([], {}), false);
});
