import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, serializeRun, deserializeRun, validateRunShape } from '../src/model/state.js';
import { startingAbilityPlan, startingAbilityProblem, startingAbilityRef, startingAbilityRefs } from '../src/model/startingAbilities.js';
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

// ---- Owner decision 13: Psychic/Earth spells as a selectable starting spell ----
const ELEMENT_STARTERS = ['mindSpike', 'mindFracture', 'drowsingMote', 'stoneSling', 'rockfall'];

test('element starting spells are offered to herald and starseer only', () => {
  for (const classId of ['herald', 'starseer']) {
    const plan = startingAbilityPlan(registries, birth(classId, { combatExpansionVersion: 2 }));
    assert.deepEqual([...plan.elementIds].sort(), [...ELEMENT_STARTERS].sort(), classId);
    assert.equal(plan.maxElementPicks, 1);
    // Skills and rares are not starting spells.
    for (const id of ['stoneskin', 'dissonance', 'wakingNightmare', 'entomb']) assert.ok(!plan.choices.some(card => card.id === id), id);
  }
  for (const classId of ['reaver', 'rogue']) {
    const plan = startingAbilityPlan(registries, birth(classId, { combatExpansionVersion: 2 }));
    assert.deepEqual(plan.elementIds, []);
    assert.ok(!plan.choices.some(card => ELEMENT_STARTERS.includes(card.id)));
  }
  // The expanded card is unavailable to a legacy run.
  assert.deepEqual(startingAbilityPlan(registries, birth('herald')).elementIds, []);
});

test('a chosen element spell lands in the starting deck as a plain card and survives save and load', () => {
  for (const classId of ['herald', 'starseer']) {
    const base = birth(classId, { combatExpansionVersion: 2 });
    const plan = startingAbilityPlan(registries, base);
    const spell = plan.choices.find(card => !plan.elementIds.includes(card.id)).id;
    const ids = [spell, 'mindSpike'];
    assert.equal(startingAbilityProblem(registries, base, ids), null);
    const run = birth(classId, { combatExpansionVersion: 2, startingAbilityIds: ids });
    assert.ok(run.deck.length <= registries.balance.startingDeckSize);
    const element = run.deck.find(inst => inst.cardId === 'mindSpike');
    assert.ok(element);
    assert.ok(!element.abilityRank, 'plain card, no ability grade');
    assert.equal(run.deck.filter(inst => inst.cardId === spell && inst.abilityRank === 1).length, 1);
    stampDeck(registries, run);
    const restored = deserializeRun(serializeRun(run));
    assert.ok(restored.deck.some(inst => inst.cardId === 'mindSpike' && !inst.abilityRank));
    assert.deepEqual(validateRunShape(restored), []);
  }
});

test('the summary and the save share one ref rule: element spells carry no ability rank', () => {
  for (const classId of ['herald', 'starseer']) {
    const base = birth(classId, { combatExpansionVersion: 2 });
    const plan = startingAbilityPlan(registries, base);
    const spell = plan.choices.find(card => !plan.elementIds.includes(card.id)).id;
    const element = plan.elementIds[0];
    // Picker and summary both key the grade off plan.elementIds via startingAbilityRef.
    assert.deepEqual(startingAbilityRef(plan, element), { cardId: element });
    assert.deepEqual(startingAbilityRef(plan, spell), { cardId: spell, abilityRank: plan.rank });
    assert.deepEqual(startingAbilityRefs(registries, base, [spell, element]), [
      { cardId: spell, abilityRank: plan.rank }, { cardId: element },
    ]);
  }
});

test('the creation picker and summary render starting spells through the shared ref rule', () => {
  // mountCustomize draws the summary inline (no model to call), so guard the wiring:
  // every starting-spell card goes through startingAbilityRef, never a bare abilityRank.
  const screen = readFileSync(new URL('../src/ui/screens/customize.js', import.meta.url), 'utf8');
  assert.match(screen, /renderCard\(registries, startingAbilityRef\(ability, cardId\)\)/);
  assert.match(screen, /renderCard\(registries, startingAbilityRef\(section, card\.id\)\)/);
  assert.doesNotMatch(screen, /abilityRank: (ability|section)\.rank/);
});

test('at most one element spell may be picked, and other classes cannot pick one', () => {
  const run = birth('herald', { combatExpansionVersion: 2 });
  assert.ok(startingAbilityProblem(registries, run, ['mindSpike', 'stoneSling']));
  assert.throws(() => birth('herald', { combatExpansionVersion: 2, startingAbilityIds: ['mindSpike', 'stoneSling'] }));
  const reaver = birth('reaver', { combatExpansionVersion: 2 });
  assert.ok(startingAbilityProblem(registries, reaver, ['mindSpike']));
});

test('births that do not choose an element spell are unchanged', () => {
  const off = createRegistries({ ...contentBundle, balance: { ...contentBundle.balance, rewards: { ...contentBundle.balance.rewards, elementAffinity: undefined } } });
  for (const classId of ['herald', 'starseer', 'reaver', 'rogue']) {
    const plan = startingAbilityPlan(registries, birth(classId, { combatExpansionVersion: 2 }));
    const ids = plan.choices.filter(card => !plan.elementIds.includes(card.id)).slice(0, plan.count).map(card => card.id);
    const withOption = birth(classId, { combatExpansionVersion: 2, startingAbilityIds: ids });
    const without = createRunState({ seed: 42, classId, registries: off, combatExpansionVersion: 2, startingAbilityIds: ids });
    assert.deepEqual(withOption.deck, without.deck, classId);
  }
});

test('the spell picker never offers a second element spell that Next would then refuse', () => {
  // Regression: a Starseer could pick Rockfall and Drowsing Mote (two element
  // spells, maxPicks 1); both satisfied the 2-pick count but startingAbilityProblem
  // refused them, leaving Next greyed with no way to tell why.
  const run = birth('starseer', { combatExpansionVersion: 2 });
  const plan = startingAbilityPlan(registries, run);
  assert.equal(plan.maxElementPicks, 1);
  assert.ok(startingAbilityProblem(registries, run, ['rockfall', 'drowsingMote']));
  const screen = readFileSync(new URL('../src/ui/screens/customize.js', import.meta.url), 'utf8');
  assert.match(screen, /elementCapReached\(\)/);
  assert.match(screen, /choose\.disabled = full \|\| elementCapped/);
  assert.match(screen, /section\.elementIds\?\.includes\(card\.id\) && elementCapReached\(\)/);
});
