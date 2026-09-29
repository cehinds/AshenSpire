import test from 'node:test';
import assert from 'node:assert/strict';
import { configuredRewardOffer } from '../src/model/rewardSourcePolicy.js';

test('battle reward checkboxes remove only the disabled reward types', () => {
  const offer = {
    cinders: 30, cardIds: ['a'], levelCards: [{ ordinal: 0, cardIds: ['b'] }],
    flaskId: 'flask', relicId: 'relic', armamentId: 'armament', xpGains: { level: 55, tracks: {} },
  };
  const off = new Set(['rewardBattleCards', 'rewardBattleRelics', 'rewardLevelCards']);
  const result = configuredRewardOffer(offer, 'elite', (key) => !off.has(key));
  assert.equal(result.cardIds, undefined);
  assert.equal(result.levelCards, undefined);
  assert.equal(result.relicId, undefined);
  assert.equal(result.cinders, 30);
  assert.equal(result.flaskId, 'flask');
  assert.deepEqual(result.xpGains, offer.xpGains, 'reward switches cannot suppress earned XP');
  assert.equal(offer.cardIds.length, 1, 'the rolled offer is not mutated');
});

test('treasure switches do not affect battle rewards', () => {
  const offer = { relicId: 'r', armamentId: 'a' };
  const enabled = (key) => key !== 'rewardTreasureArmaments';
  assert.deepEqual(configuredRewardOffer(offer, 'treasure', enabled), { relicId: 'r' });
  assert.deepEqual(configuredRewardOffer(offer, 'boss', enabled), offer);
});
