import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseAutoCombatAction as choose, resolveCombatAutomation } from '../src/model/autoCombatPolicy.js';
import { settingsRows } from '../src/ui/screens/settings.js';
import { profileKeys } from '../src/model/settingsSync.js';
const settings = { autoCombat: true };
const attack = { cardInstanceId: 'strike', targetId: 'enemy', legal: true, affordable: true, offense: 2 };
const guard = { cardInstanceId: 'guard', legal: true, affordable: true, defense: 2 };
const input = extra => ({ settings, phase: 'player', candidates: [attack, guard], ...extra });
test('policy defaults are off, ×1, offense and a half-second delay', () => {
  assert.deepEqual(resolveCombatAutomation(), { enabled: false, speed: 1, preference: 'offense', delayMs: 500 });
  assert.equal(choose(input({ settings: {} })), null);
  assert.equal(resolveCombatAutomation({ combatSpeed: NaN }).speed, 1);
  assert.equal(resolveCombatAutomation({ combatSpeed: 999 }).speed, 8);
});
test('preferences choose legal affordable cards and never inspect hidden data', () => {
  const forbidden = { get intent() { throw Error('hidden intent read'); }, get rng() { throw Error('RNG read'); } };
  assert.deepEqual(choose(Object.assign(Object.create(forbidden), input())), { type: 'playCard', cardInstanceId: 'strike', targetId: 'enemy' });
  assert.equal(choose(input({ settings: { autoCombat: true, combatPreference: 'defense' } })).cardInstanceId, 'guard');
  assert.deepEqual(choose(input({ candidates: [{ ...attack, legal: false }, { ...guard, affordable: false }] })), { type: 'endTurn' });
  assert.equal(choose(input({ candidates: [], canEndTurn: false })), null);
});
test('modal, unresolved target, deck edits, queue and defeat pause automation', () => {
  for (const flag of ['busy', 'pendingReaction', 'modalOpen', 'targetUnresolved', 'deckEditing', 'queued']) assert.equal(choose(input({ [flag]: true })), null, flag);
  assert.equal(choose(input({ result: 'defeat' })), null);
  assert.equal(choose(input({ phase: 'enemy' })), null);
});
test('known Perception and stance information break ties without mutating candidates', () => {
  const candidates = [{ ...attack, cardInstanceId: 'a' }, { ...attack, cardInstanceId: 'b', stanceAdvantage: 0.2, knownHitChance: 0.8 }];
  const before = structuredClone(candidates);
  assert.equal(choose(input({ candidates })).cardInstanceId, 'b'); assert.deepEqual(candidates, before);
});

test('automation settings participate in durable profile export and reset rows', () => {
  const rows = settingsRows();
  const keys = profileKeys(rows);
  for (const key of ['autoCombat', 'combatSpeed', 'combatPreference', 'combatActionDelay']) {
    assert.ok(rows.some(row => row.key === key)); assert.ok(keys.includes(key), key);
  }
});
