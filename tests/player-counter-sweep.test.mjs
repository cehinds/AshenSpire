import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playerCounterSweepSprites as selected } from '../src/content/playerCounterSweepSprites.js';
import { alternativeCardAnimations as original } from '../src/content/alternativeCardAnimations.js';
import { sampleSequence, durationFor } from '../src/model/alternativeCardAnimation.js';
import { ANIM_SPEEDS } from '../src/ui/animationPace.js';
import { createStanceLedger } from '../src/model/alternativeStance.js';

const favorites = {
  reaver: ['reaver-counter-03', 'reaver-sweep-01'],
  starseer: ['starseer-counter-01', 'starseer-sweep-01'],
  herald: ['herald-counter-01', 'herald-sweep-03'],
  rogue: ['rogue-counter-03', 'rogue-sweep-05'],
};

test('all eight owner choices use four phases and clear independent effects at original idle', () => {
  const art = JSON.parse(readFileSync(new URL('../art-manifest.json', import.meta.url)));
  for (const [actor, ids] of Object.entries(favorites)) {
    const family = selected[actor];
    assert.deepEqual(Object.keys(family.sequences), ['counter', 'sweep']);
    assert.equal(Object.keys(family.frames).length, 6);
    assert.equal(Object.keys(family.effects).length, 4);
    for (const [index, action] of ['counter', 'sweep'].entries()) {
      const seq = family.sequences[action];
      assert.equal(seq.selection, ids[index]);
      assert.equal(seq.poses.length, 4);
      assert.equal(seq.poses[0], family.stances[action]);
      assert.equal(seq.poses.at(-1), 'ready');
      assert.ok(original.classes[actor].frames.ready);
      assert.deepEqual(seq.durations, [55, 60, 65, 80]);
      assert.equal(seq.effects[0], null);
      assert.equal(seq.effects.at(-1), null);
      assert.ok(seq.effects.slice(1, 3).every(id => family.effects[id]));
      for (const speed of Object.values(ANIM_SPEEDS).filter(Boolean)) {
        const duration = durationFor(seq, speed);
        const impact = 55 / 260 * duration;
        assert.ok(impact <= speed.impactCapMs);
        assert.equal(sampleSequence(seq, impact + .001, duration).index, 1);
        assert.equal(seq.effects[sampleSequence(seq, duration, duration).index], null);
      }
      assert.equal(seq.effects[sampleSequence(seq, 100, 260, { reduced: true }).index], null);
    }
    for (const frame of Object.values({ ...family.frames, ...family.effects })) {
      const record = art.assets[frame.path];
      assert.ok(record?.high && record?.light, frame.path);
      assert.equal(record.high.sha256, frame.sha256);
      assert.deepEqual(frame.anchor, [256, 464]);
      assert.deepEqual(frame.rasterSize, [256, 256]);
    }
  }
});

test('confirmed counter and sweep stances remain independent across co-op seats and turn resets', () => {
  const ledger = createStanceLedger();
  for (const [actor, action] of [['a', 'counter'], ['b', 'sweep']]) {
    ledger.accept({ type: 'cardPlayed', playerId: actor }, { cardTags: ['camp:physical', 'maneuver:' + action] });
    assert.equal(ledger.get(actor), action);
  }
  ledger.accept({ type: 'cardPlayFailed', playerId: 'a' });
  assert.equal(ledger.get('a'), 'counter');
  ledger.accept({ type: 'playerTurnStart', playerId: 'a' });
  assert.equal(ledger.get('a'), null);
  assert.equal(ledger.get('b'), 'sweep');
});
