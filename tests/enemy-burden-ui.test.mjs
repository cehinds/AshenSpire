import test from 'node:test';
import assert from 'node:assert/strict';
import { projectEnemyBurdenHand } from '../src/ui/models/EnemyBurdenModel.js';
import { coopEnemyIntent } from '../src/ui/models/CoopIntentModel.js';

const registries = { cards: new Map([
  ['base.stagger-status-card', { name: 'Stagger', type: 'Status' }],
  ['base.paralysis-status-card', { name: 'Paralysis', type: 'Status' }],
]) };
const enemy = {
  proposalIntentRevealedUntilByOwner: { scout: 4 },
  burdenPiles: { hand: [{ cardId: 'base.stagger-status-card' }, { cardId: 'base.stagger-status-card' },
    { cardId: 'base.paralysis-status-card' }], draw: [{ cardId: 'secret' }], discard: [], exhaust: [] },
  intent: { kind: 'attack', moveId: 'secretMove', damage: 9, hidden: true },
  intentReads: { scout: false },
};

test('explicit hand read groups names/types/counts without leaking other pile identities', () => {
  const before = structuredClone(enemy);
  const read = projectEnemyBurdenHand(enemy, { turn: 3, registries, ownerId: 'scout' });
  assert.deepEqual(read.cards, [{ name: 'Stagger', type: 'Status', count: 2 },
    { name: 'Paralysis', type: 'Status', count: 1 }]);
  assert.deepEqual(read.counts, { draw: 1, hand: 3, discard: 0, exhaust: 0 });
  assert.doesNotMatch(JSON.stringify(read), /secret/);
  assert.deepEqual(enemy, before);
});

test('hand identities and pile counts disappear exactly at expiry, and missing turn fails closed', () => {
  for (const turn of [4, 5, undefined]) assert.equal(projectEnemyBurdenHand(enemy, { turn, registries, ownerId: 'scout' }), null);
  assert.equal(projectEnemyBurdenHand({ ...enemy, proposalIntentRevealedUntilByOwner: {} }, { turn: 3, registries, ownerId: 'scout' }), null);
});

test('host redacted explicit read is shared between seats, then normal private gates resume', () => {
  const burdenRead = projectEnemyBurdenHand(enemy, { turn: 3, registries, ownerId: 'scout' });
  const revealed = coopEnemyIntent({ ...enemy, burdenRead }, 'scout');
  assert.equal(revealed.hidden, false);
  assert.equal(revealed.moveId, 'secretMove');
  assert.deepEqual(revealed.burdenRead, burdenRead);
  const expired = coopEnemyIntent({ ...enemy, burdenRead: null }, 'scout');
  assert.equal(expired.hidden, true);
  assert.equal(expired.moveId, null);
  assert.equal(expired.burdenRead, undefined);
});


test('an active empty hand is explicit; unknown instances never disclose internal IDs', () => {
  const empty = projectEnemyBurdenHand({ ...enemy, burdenPiles: {} }, { turn: 3, registries, ownerId: 'scout' });
  assert.deepEqual(empty.cards, []);
  const unknown = projectEnemyBurdenHand({ ...enemy, burdenPiles: { hand: [{ cardId: 'secret.unregistered' }] } }, { turn: 3, registries, ownerId: 'scout' });
  assert.deepEqual(unknown.cards, [{ name: 'Unknown card', type: 'Unknown', count: 1 }]);
  assert.doesNotMatch(JSON.stringify(unknown), /unregistered/);
});
