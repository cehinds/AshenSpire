// WARD RESIST SOUND. A hit Ward takes, in whole or in part, sounds its own
// `wardResist` recipe, once per hit: with the RESISTED word when Ward took the
// whole hit (withCallout), or with the hit's number when HP was also hit
// (hitSounds). A hit Ward did not touch never sounds it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { playTimeline, setAnimSpeed, setBeatOrder } from '../src/ui/fx.js';
import { registerStage } from '../src/ui/services/PoseAnimator.js';
import { sfx } from '../src/ui/sfx.js';
import { haptic } from '../src/ui/haptics.js';
import { SFX_RECIPES } from '../src/content/sfx.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const enemyHit = (over) => [
  { type: 'enemyMoveStarted', sourceId: 'e1', kind: 'attack' },
  { type: 'damageDealt', sourceId: 'e1', targetId: 'player', amount: 0, blocked: 0, ...over },
];

// Plays a receipt list through the real timeline and returns the sound ids in order.
function soundsFor(t, events, beatOrder) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  const sounds = [];
  const oldSink = sfx.sink, oldHaptic = haptic.sink;
  sfx.sink = (id) => sounds.push(id);
  haptic.sink = () => {};
  try {
    withKitDom((dom) => {
      const el = () => dom.document.createElement('div');
      const anchors = { player: el(), e1: el() };
      for (const anchor of Object.values(anchors)) registerStage(anchor, { play: () => true, hold() { return true; }, settle() {} });
      let completed = 0;
      playTimeline(events, { layer: el(), combatEl: el(), beatOrder, anchorFor: (id) => anchors[id] || null,
        animateActor: () => ({ impactMs: 100, totalMs: 300, hold() {}, cancel() {} }),
        onBeatApplied() {}, onFlush() {} }, () => completed++);
      for (let i = 0; i < 4000 && !completed; i++) t.mock.timers.tick(1);
      assert.equal(completed, 1);
    });
  } finally { sfx.sink = oldSink; haptic.sink = oldHaptic; setAnimSpeed('normal'); setBeatOrder('sequential'); }
  return sounds;
}

const count = (sounds, id) => sounds.filter((s) => s === id).length;

test('the wardResist recipe exists and is authored as layered tones and noise', () => {
  assert.ok(Array.isArray(SFX_RECIPES.wardResist), 'a wardResist row');
  assert.ok(SFX_RECIPES.wardResist.length >= 2);
});

for (const beatOrder of ['sequential', 'impact']) {
  test(`${beatOrder}: a Ward that absorbs part of a hit sounds wardResist once, with the hit sound`, (t) => {
    const sounds = soundsFor(t, enemyHit({ amount: 6, wardAbsorbed: 3 }), beatOrder);
    assert.equal(count(sounds, 'wardResist'), 1, `wardResist once: ${sounds.join(',')}`);
    assert.ok(sounds.some((s) => /^(hit_|playerHurt)/.test(s)), 'the hit sound still plays');
  });

  test(`${beatOrder}: a Ward that takes a whole hit (RESISTED) sounds wardResist exactly once`, (t) => {
    const sounds = soundsFor(t, enemyHit({ amount: 0, wardAbsorbed: 3 }), beatOrder);
    assert.equal(count(sounds, 'wardResist'), 1, `wardResist once: ${sounds.join(',')}`);
    assert.ok(!sounds.some((s) => /^(hit_|playerHurt)/.test(s)), 'no HP hit sound for a fully absorbed hit');
  });

  test(`${beatOrder}: a plain HP hit never sounds wardResist`, (t) => {
    assert.equal(count(soundsFor(t, enemyHit({ amount: 6 }), beatOrder), 'wardResist'), 0);
  });

  test(`${beatOrder}: a Block-only hit never sounds wardResist`, (t) => {
    assert.equal(count(soundsFor(t, enemyHit({ amount: 5, blocked: 5 }), beatOrder), 'wardResist'), 0);
  });

  test(`${beatOrder}: a hit with no effect at all never sounds wardResist`, (t) => {
    assert.equal(count(soundsFor(t, enemyHit({ amount: 0 }), beatOrder), 'wardResist'), 0);
  });
}
