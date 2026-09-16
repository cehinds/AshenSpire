import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolvePerformanceMode, resolveCombatPacing } from '../src/ui/performance.js';
import { preloadPoses, clearPosePreloads } from '../src/ui/services/posePreloads.js';
import { runtimeAsset } from '../tools/assetmime.mjs';

test('automatic quality follows input capability; explicit quality and pacing win', () => {
  assert.equal(resolvePerformanceMode({}, true), 'lite');
  assert.equal(resolvePerformanceMode({}, false), 'full');
  assert.equal(resolvePerformanceMode({ performanceMode: 'full' }, true), 'full');
  assert.equal(resolvePerformanceMode({ performanceMode: 'lite' }, false), 'lite');
  assert.equal(resolveCombatPacing({}, 'lite'), 'fast');
  assert.equal(resolveCombatPacing({ animSpeed: 'auto' }, 'full'), 'normal');
  for (const animSpeed of ['slow', 'normal', 'fast', 'instant']) {
    assert.equal(resolveCombatPacing({ animSpeed }, 'lite'), animSpeed);
  }
});

test('pose preloads deduplicate images and reuse a bounded recent working set', () => {
  let allocated = 0;
  globalThis.Image = class { constructor() { allocated++; } };
  try {
    clearPosePreloads();
    const first = preloadPoses('first', ['one.webp', 'one.webp', 'two.webp']);
    assert.equal(allocated, 2);
    assert.equal(preloadPoses('first', ['one.webp', 'two.webp']), first);
    for (let i=0;i<4;i++) preloadPoses('other'+i, ['other'+i+'.webp']);
    assert.notEqual(preloadPoses('first', ['one.webp', 'two.webp']), first, 'oldest preload group was evicted');
    assert.equal(allocated, 8);
  } finally { delete globalThis.Image; clearPosePreloads(); }
});

test('lite and reduced-motion sessions allocate no pose preloads', () => {
  globalThis.Image = class { constructor() { throw Error('unexpected image allocation'); } };
  globalThis.document = { documentElement: { dataset: { performance: 'lite' } }, body: { classList: { contains: () => false } } };
  try {
    assert.deepEqual(preloadPoses('lite', ['unused.webp']), []);
    document.documentElement.dataset.performance = 'full';
    document.body.classList.contains = () => true;
    assert.deepEqual(preloadPoses('reduced', ['unused.webp']), []);
  } finally { delete globalThis.Image; delete globalThis.document; clearPosePreloads(); }
});

test('authoring equipment stays out of both builds; runtime art stays included', () => {
  assert.equal(runtimeAsset('equipment/components/v1/reaver/reaver_boots.webp'), false);
  assert.equal(runtimeAsset('equipment\\components\\v1\\reaver\\reaver_boots.webp'), false);
  for (const path of ['equipment/weapon_greatsword.webp', 'poses/reaver_idle_gold.webp', 'enemy-states/husk_guard.webp']) assert.equal(runtimeAsset(path), true);
  function check(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) check(file);
      else if (entry.name.endsWith('.js')) assert.doesNotMatch(readFileSync(file,'utf8'), /assets\/equipment\/components\//, file.pathname);
    }
  }
  check(new URL('../src/', import.meta.url));
});
