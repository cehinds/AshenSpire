import test from 'node:test';
import assert from 'node:assert/strict';
import { coveragePass, cssPixelCount } from '../tools/footer-paint.mjs';

test('painted footer coverage measures source ink instead of transparent padding', () => {
  assert.equal(coveragePass({ own: .05, artwork: { decoded: true, expectedInk: 1000, ownPixels: 800 } }), true);
  for (const artwork of [
    { decoded: false, expectedInk: 1000, ownPixels: 800 },
    { decoded: true, expectedInk: 0, ownPixels: 800 },
    { decoded: true, expectedInk: 1000, ownPixels: 0 },
    { decoded: true, expectedInk: 1000, ownPixels: 200 },
  ]) assert.equal(coveragePass({ own: .8, artwork }), false);
  assert.equal(coveragePass({ own: .24 }), false);
  assert.equal(coveragePass({ own: .26 }), true);
});

test('source ink and screenshot coverage use identical units at DPR 1 and 2', () => {
  for (const dpr of [1,2]) for (const pixels of [200,800]) {
    const ownPixels=cssPixelCount(pixels*dpr*dpr,100*dpr,100*dpr,{width:100,height:100});
    assert.equal(ownPixels,pixels);
    assert.equal(coveragePass({own:.1,artwork:{decoded:true,expectedInk:1000,ownPixels}}),pixels===800);
  }
});
