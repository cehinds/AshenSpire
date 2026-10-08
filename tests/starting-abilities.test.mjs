import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, serializeRun, deserializeRun, validateRunShape } from '../src/model/state.js';
import { startingAbilityPlan, startingAbilityProblem } from '../src/model/startingAbilities.js';
import { stampDeck } from '../src/model/loadout.js';
import { resolveCard } from '../src/model/registries.js';

const registries = createRegistries(contentBundle);
// Historical additive deck-size contract; v2 starter coverage has a deck cap.
const birth = (classId, extra = {}) => createRunState({ seed: 42, classId, registries, combatExpansionVersion: 1, ...extra });

for (const [classId, count, kind] of [['reaver', 1, 'maneuver'], ['rogue', 1, 'maneuver'], ['starseer', 2, 'spell'], ['herald', 2, 'spell']]) {
  test(`${classId} chooses ${count} legal Rank 1 ${kind} cards that survive restamp and save`, () => {
    const original = birth(classId);
    const plan = startingAbilityPlan(registries, original);
    assert.equal(plan.count, count);
    assert.ok(plan.choices.length >= count);
    assert.ok(plan.choices.every(card => card.abilityKind === kind));
    const ids = plan.choices.slice(0, count).map(card => card.id);
    const run = birth(classId, { startingAbilityIds: ids });
    const chosen = run.deck.filter(inst => ids.includes(inst.cardId) && inst.abilityRank === 1);
    assert.equal(chosen.length, count);
    assert.equal(run.deck.length, original.deck.length + count);
    assert.ok(chosen.every(inst => resolveCard(registries, inst).abilityRank === 1));
    assert.ok(chosen.every(inst => inst.exposureBuildupPerHit === resolveCard(registries, { cardId: inst.cardId, abilityRank: 1 }).exposureBuildupPerHit));
    stampDeck(registries, run);
    const restored = deserializeRun(serializeRun(run));
    assert.deepEqual(restored.deck.filter(inst => chosen.some(row => row.instanceId === inst.instanceId)), chosen);
    assert.deepEqual(validateRunShape(restored), []);
  });
}

test('expanded starters retain every selected Rank 1 ability within their capped deck after restamp and reload', () => {
  for (const classId of ['reaver', 'rogue', 'starseer', 'herald']) {
    const original = birth(classId, { combatExpansionVersion: 2 });
    const plan = startingAbilityPlan(registries, original);
    const ids = plan.choices.slice(0, plan.count).map(card => card.id);
    const run = birth(classId, { combatExpansionVersion: 2, startingAbilityIds: ids });
    assert.equal(run.combatExpansionVersion, 2);
    assert.ok(run.deck.length <= registries.balance.startingDeckSize);
    assert.equal(run.deck.filter(card => ids.includes(card.cardId) && card.abilityRank === 1).length, plan.count);
    stampDeck(registries, run);
    const restored = deserializeRun(serializeRun(run));
    assert.equal(restored.deck.filter(card => ids.includes(card.cardId) && card.abilityRank === 1).length, plan.count);
    assert.deepEqual(validateRunShape(restored), []);
  }
});

test('birth rejects missing, duplicate, wrong-kind and unavailable choices', () => {
  const run = birth('starseer');
  const ids = startingAbilityPlan(registries, run).choices.slice(0, 2).map(card => card.id);
  for (const picked of [[], [ids[0]], [...ids, ids[0]], [ids[0], ids[0]], ['crimsonCleave', ids[0]], ['missing', ids[0]]]) {
    assert.ok(startingAbilityProblem(registries, run, picked));
    assert.throws(() => birth('starseer', { startingAbilityIds: picked }));
  }
  assert.equal(startingAbilityProblem(registries, run, ids), null);
});

test('maneuver eligibility follows equipped hands instead of offering unusable weapon cards', () => {
  const shield = birth('reaver');
  const bare = birth('reaver', { startingHands: { leftHand: null, rightHand: null } });
  const pool = run => startingAbilityPlan(registries, run).choices.map(card => card.id);
  assert.ok(pool(shield).includes('shieldBash'));
  assert.ok(!pool(bare).includes('shieldBash'));
  assert.throws(() => birth('reaver', { startingHands: { leftHand: null, rightHand: null }, startingAbilityIds: ['shieldBash'] }));
});

test('Herald cannot select another copy of its already-granted spell', () => {
  const run = birth('herald');
  assert.ok(run.deck.some(inst => inst.cardId === 'blightTouch'));
  assert.ok(!startingAbilityPlan(registries, run).choices.some(card => card.id === 'blightTouch'));
  assert.throws(() => birth('herald', { startingAbilityIds: ['blightTouch', 'penance'] }));
});

test('configured copy limits allow an already-granted spell as a starting ability', () => {
  const settings = { classSpellPowerCopies: 2 };
  const profileMeta = { settings };
  const run = birth('herald', { profileMeta });
  assert.ok(startingAbilityPlan(registries, run, settings).choices.some(card => card.id === 'blightTouch'));
  const started = birth('herald', { profileMeta, startingAbilityIds: ['blightTouch', 'penance'] });
  assert.equal(started.deck.filter(inst => inst.cardId === 'blightTouch').length, 2);
});
