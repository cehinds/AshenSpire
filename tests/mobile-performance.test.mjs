import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { motionFlags, effectsOff, motionOff, resolveMotionIdle, resolvePerformanceMode, resolveCombatPacing, migrateEffectsSetting, effectsEnabled } from '../src/ui/performance.js';
import { preloadPoses, clearPosePreloads } from '../src/ui/services/posePreloads.js';
import { runtimeAsset } from '../tools/assetmime.mjs';

test('Effects decides quality (off is lite everywhere, on is full); pacing is independent of it', () => {
  assert.equal(resolvePerformanceMode({}, true), 'lite');
  assert.equal(resolvePerformanceMode({}, false), 'lite', 'default is off on every device');
  assert.equal(resolvePerformanceMode({ effects: true }, true), 'full');
  assert.equal(resolvePerformanceMode({ effects: false }, false), 'lite');
  assert.equal(resolvePerformanceMode({ performanceMode: 'full' }, true), 'full', 'a saved explicit Full still reads as on');
  assert.equal(resolvePerformanceMode({ performanceMode: 'lite', effects: true }, false), 'full', 'an explicit Effects wins');
  // Pacing follows the touch screen, never Effects: auto is fast on a phone and normal elsewhere.
  assert.equal(resolveCombatPacing({}, true), 'fast');
  assert.equal(resolveCombatPacing({ animSpeed: 'auto' }, false), 'normal');
  for (const effects of [true, false]) {
    assert.equal(resolveCombatPacing({ effects }, true), 'fast', 'phone pace ignores Effects');
    assert.equal(resolveCombatPacing({ effects }, false), 'normal', 'desktop pace ignores Effects');
  }
  for (const animSpeed of ['slow', 'normal', 'fast', 'instant']) {
    assert.equal(resolveCombatPacing({ animSpeed }, true), animSpeed);
    assert.equal(resolveCombatPacing({ animSpeed }, false), animSpeed);
  }
});

test('a saved explicit Full quality migrates once to Effects on; everything else to off', () => {
  const full = { performanceMode: 'full', screenShake: false };
  assert.equal(migrateEffectsSetting(full), true);
  assert.deepEqual(full, { effects: true, screenShake: false });
  assert.equal(migrateEffectsSetting(full), false, 'idempotent');
  for (const performanceMode of ['auto', 'lite']) {
    const s = { performanceMode };
    assert.equal(migrateEffectsSetting(s), true);
    assert.deepEqual(s, {});
    assert.equal(effectsEnabled(s), false);
  }
  const chosen = { performanceMode: 'full', effects: false };
  migrateEffectsSetting(chosen);
  assert.deepEqual(chosen, { effects: false }, 'an explicit Effects choice is never overwritten');
  assert.equal(migrateEffectsSetting({}), false);
});

test('pose preloads deduplicate images and reuse a bounded recent working set', () => {
  let allocated = 0;
  globalThis.Image = class { constructor() { allocated++; } addEventListener() {} };
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

test('idle motion defaults off on touch devices and on elsewhere; a saved choice wins', () => {
  const real = globalThis.matchMedia;
  try {
    globalThis.matchMedia = () => ({ matches: true });
    assert.equal(resolveMotionIdle({}), false, 'phone default');
    assert.equal(resolveMotionIdle({ motionIdle: true }), true, 'explicit on wins on a phone');
    globalThis.matchMedia = () => ({ matches: false });
    assert.equal(resolveMotionIdle({}), true, 'desktop default');
    assert.equal(resolveMotionIdle({ motionIdle: false }), false, 'explicit off wins on desktop');
  } finally { if (real) globalThis.matchMedia = real; else delete globalThis.matchMedia; }
});

test('each fighter-motion option maps to its body class flag, all on by default (idle off on touch)', () => {
  const real = globalThis.matchMedia;
  try {
    globalThis.matchMedia = () => ({ matches: false });
    assert.deepEqual(motionFlags({}), { attack: true, hit: true, idle: true, defeat: true });
    globalThis.matchMedia = () => ({ matches: true });
    assert.deepEqual(motionFlags({}), { attack: true, hit: true, idle: false, defeat: true });
    for (const [key, kind] of [['motionAttack', 'attack'], ['motionHit', 'hit'], ['motionIdle', 'idle'], ['motionDefeat', 'defeat']]) {
      assert.equal(motionFlags({ [key]: false })[kind], false, `${key} off`);
      assert.equal(motionFlags({ [key]: true })[kind], true, `${key} on`);
    }
    // Effects is independent of every motion option
    assert.deepEqual(motionFlags({ effects: false, motionHit: false }), { attack: true, hit: false, idle: false, defeat: true });
  } finally { if (real) globalThis.matchMedia = real; else delete globalThis.matchMedia; }
});

test('the motion body classes and the Effects root attribute are what the helpers read', () => {
  const classes = new Set(['motion-hit-off']);
  globalThis.document = { documentElement: { dataset: { effects: 'off' } }, body: { classList: { contains: c => classes.has(c) } } };
  try {
    assert.equal(effectsOff(), true);
    assert.equal(motionOff('hit'), true);
    assert.equal(motionOff('attack'), false);
    document.documentElement.dataset.effects = 'on';
    assert.equal(effectsOff(), false, 'toggling on at runtime flips the reading with no reload');
  } finally { delete globalThis.document; }
});

test('the Effects toggle never changes the pace, so callout lifetimes are the same on and off', async () => {
  const { ANIM_SPEEDS } = await import('../src/ui/fx.js');
  for (const coarse of [true, false]) {
    const on = resolveCombatPacing({ effects: true }, coarse), off = resolveCombatPacing({ effects: false }, coarse);
    assert.equal(on, off);
    assert.deepEqual(ANIM_SPEEDS[on], ANIM_SPEEDS[off]);
  }
});
