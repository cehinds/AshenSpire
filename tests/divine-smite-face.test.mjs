// Owner rule (shown = dealt): a divine hit that breaks Poise also deals 50% of the hit straight to HP (Smite), so the quoted per-hit HP carries it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fight } from './elementFixture.mjs';
import { previewCard, dispatch } from '../src/engine/combat.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

const quoteAndPlay = poise => {
  const { combat, enemy } = fight({ enemies: 1, poise });
  const hand = combat.piles.hand[0];
  hand.cardId = 'core.dawnFlame'; hand.upgraded = false;
  primeAccuracyRolls(combat);
  const row = previewCard(combat, hand.instanceId, enemy.id).values.find(value => value.op === 'damage');
  const before = enemy.hp;
  dispatch(combat, { type: 'playCard', cardInstanceId: hand.instanceId, targetId: enemy.id });
  return { quoted: row.perTargetHitDamages[enemy.id].reduce((sum, n) => sum + n, 0), lost: before - enemy.hp, enemy };
};

test('a divine hit that breaks Poise quotes the Smite: the quoted HP is the HP lost', () => {
  const { quoted, lost, enemy } = quoteAndPlay(4);
  assert.equal(enemy.persistentPoise.value, 0, 'the hit broke Poise');
  assert.equal(quoted, lost);
});

test('a divine hit that breaks nothing quotes what it takes, as before', () => {
  const { quoted, lost } = quoteAndPlay(500);
  assert.equal(quoted, lost);
});
