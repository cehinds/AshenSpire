import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCombatAnimation } from '../src/model/combatAnimation.js';
import { CARD_ACTION_CLASSES, CARD_ACTIONS, durationFor, sampleSequence } from '../src/model/alternativeCardAnimation.js';
import { createStanceLedger } from '../src/model/alternativeStance.js';
import { alternativeCardAnimations as actions } from '../src/content/alternativeCardAnimations.js';
import { alternativeSelectedStances as stances } from '../src/content/alternativeSelectedStances.js';
import { ANIM_SPEEDS, getAnimSpeed, setAnimSpeed } from '../src/ui/animationPace.js';
import { getAnimSpeed as effectSpeed, setAnimSpeed as setEffectSpeed } from '../src/ui/fx.js';
import { rearPlayerArtRecords } from '../tools/asset-pack.mjs';

test('rear class choreography follows resolved cards with stationary guard and ranged families', () => {
  for (const classId of CARD_ACTION_CLASSES) for (const action of CARD_ACTIONS) {
    const magical = ['spell', 'rangedMagic'].includes(action);
    const maneuver = action === 'spell' ? 'attack' : action === 'rangedMagic' ? 'ranged' : action;
    const card = { cardTags: ['maneuver:' + maneuver, 'camp:' + (magical ? 'spell' : 'physical')] };
    const plan = resolveCombatAnimation(card, [], { classId });
    assert.equal(plan.technique, action);
    assert.equal(plan.family, ['counter', 'defend'].includes(action) ? 'guard'
      : action.startsWith('ranged') ? 'projectile' : action === 'spell' ? 'spell' : 'strike');
    const sequence = actions.classes[classId].sequences[action];
    assert(sequence.poses.every(pose => actions.classes[classId].frames[pose]));
    for (const pace of Object.values(ANIM_SPEEDS).filter(Boolean)) {
      const duration = durationFor(sequence, pace);
      assert.equal(duration, pace.lungeMs);
      assert.equal(sampleSequence(sequence, duration, duration).x, 0);
      assert.equal(sampleSequence(sequence, duration / 2, duration, { reduced: true }).x, 0);
    }
  }
  setEffectSpeed('fast'); assert.equal(getAnimSpeed(), 'fast');
  setAnimSpeed('instant'); assert.equal(effectSpeed(), 'instant');
  setAnimSpeed('invalid'); assert.equal(getAnimSpeed(), 'normal');
});

test('confirmed card stances persist per player until their next turn', () => {
  const ledger = createStanceLedger();
  ledger.accept({ type: 'cardPlayed', playerId: 'one' }, { cardTags: ['maneuver:attack', 'camp:physical'] });
  ledger.accept({ type: 'cardPlayed', playerId: 'two' }, { cardTags: ['maneuver:defend', 'camp:physical'] });
  assert.deepEqual(ledger.snapshot(), { one: 'offensive', two: 'defensive' });
  ledger.accept({ type: 'hpLost', targetId: 'one' });
  assert.equal(ledger.get('one'), 'offensive');
  ledger.accept({ type: 'playerTurnStart', playerId: 'one' });
  assert.equal(ledger.get('one'), null);
  assert.equal(ledger.get('two'), 'defensive');
  ledger.accept({ type: 'combatStarted' });
  assert.deepEqual(ledger.snapshot(), {});
});

test('all action and stance frames ship with verified hashes and a common foot anchor', () => {
  const records = rearPlayerArtRecords();
  let total = 0;
  for (const catalog of [actions, stances]) for (const { frames } of Object.values(catalog.classes)) {
    for (const frame of Object.values(frames)) {
      assert.deepEqual(frame.anchor, [256, 464]);
      for (const path of [frame.path, frame.lite]) {
        assert(records[path]?.common.bytes > 0, path);
        total++;
      }
    }
  }
  assert.equal(total, Object.keys(records).length);
});
