import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { equippedPieces } from '../src/model/loadout.js';
import { resolveCombatAnimation } from '../src/model/combatAnimation.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat, runCombatPlayer } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { resolvePlayedCombatCard } from '../src/ui/models/PlayedCombatCard.js';

const registries = createRegistries(contentBundle);
function mounted(version, seed = 11) {
  const run = createRunState({ registries, seed, classId: 'reaver', combatExpansionVersion: version });
  const card = run.deck.find(card => card.cardId === 'shieldBash' && card.grantedBy === 'roundShield');
  assert.ok(card, 'use the actual mounted equipment instance');
  card.abilityRank = 1;
  run.deck = [card, ...run.deck.filter(entry => entry !== card)];
  return { run, card };
}
const route = (definition, run, version) => resolveCombatAnimation(definition,
  equippedPieces(registries, run.loadout, run.class), { combatExpansionVersion: version, classId: run.class, appearance: 'classic' });

test('triggered alternative counters use the selected return attack for every default class', () => {
  const attack = { type: 'attack', kindIds: ['classification.attack'], cardTags: ['camp:physical', 'maneuver:attack'] };
  for (const classId of ['reaver', 'starseer', 'herald', 'rogue']) {
    const preparation = resolveCombatAnimation({ ...attack, cardTags: ['camp:physical', 'maneuver:counter'] }, [],
      { classId, appearance: 'alternative', combatExpansionVersion: 2 });
    assert.equal(preparation.technique, 'counterPrepare', 'queued snapshots and paced card beats receive the same preparation pose');
    assert.equal(preparation.rest, 'counter');
    const plan = resolveCombatAnimation(attack, [], { classId, appearance: 'alternative', combatExpansionVersion: 2, counterTriggered: true });
    assert.equal(plan.technique, 'counter');
    assert.equal(plan.rest, null, 'the reaction does not replace the last confirmed stance');
    assert.equal(resolveCombatAnimation(attack, [], { classId, appearance: 'classic', counterTriggered: true }).technique, 'attack');
  }
});

for (const version of [1, 2]) test(`actual mounted Shield Bash version ${version} uses the committed action and permanent instance`, () => {
  const { run, card } = mounted(version);
  const combat = createRunCombat({ registries, run, rng: createRng(11), enemyIds: ['wanderingSoldier'], settings: { playInDeckOrder: true } });
  const instance = structuredClone(combat.piles.hand.find(entry => entry.instanceId === card.instanceId));
  assert.ok(instance);
  combat.player.energy = combat.player.stamina = 20;
  combat.player.mana = 20;
  const tier = version === 2 ? 2 : undefined;
  const expected = resolveCombatCard(combat, instance, { upcastTier: tier });
  const hp = combat.enemies[0].hp;
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId,
    targetId: version === 2 ? combat.player.id : combat.enemies[0].id,
    ...(tier === undefined ? {} : { upcastTier: tier }) });
  const receipt = out.events.find(event => event.type === 'cardPlayed');
  assert.ok(receipt);
  const definition = resolvePlayedCombatCard(combat, receipt, instance);
  assert.deepEqual(definition.effects, expected.effects);
  assert.deepEqual(definition.cardTags, receipt.cardTags, 'effective committed tags override raw mounted-profile tags');
  const plan = route(definition, run, version);
  if (version === 2) {
    assert.equal(receipt.upcastTier, 2);
    assert.deepEqual(receipt.cardInstance, instance, 'profile, grade, mods and source survive hand consumption');
    assert.notEqual(receipt.cardInstance, instance);
    assert.equal(definition.upcastTier, 2);
    assert.deepEqual(definition.counterPayload, expected.counterPayload);
    assert.deepEqual([plan.group, plan.technique, plan.rest], ['defend', 'guard', 'guard']);
    const alternative = resolveCombatAnimation(definition, equippedPieces(registries, run.loadout, run.class),
      { combatExpansionVersion: version, classId: run.class, appearance: 'alternative' });
    assert.deepEqual([alternative.group, alternative.technique, alternative.rest], ['defend', 'counterPrepare', 'counter'],
      'the alternative class Counter braces without falling back to an attack');
    assert.equal(combat.enemies[0].hp, hp, 'preparation produces no immediate enemy attack');
    assert.equal(combat.player.combatCounter.charges, 1);
    assert.deepEqual(resolvePlayedCombatCard(combat, receipt, { cardId: 'strike' }).effects, expected.effects,
      'receipt remains authoritative after the picker and hand have changed');
  } else {
    assert.equal(receipt.cardInstance, undefined);
    assert.equal(receipt.upcastTier, undefined);
    assert.deepEqual([plan.group, plan.technique, plan.rest], ['attack', 'attack', null]);
    assert.ok(combat.enemies[0].hp < hp);
  }
});

test('expanded Dodge and dagger Counter prepare defense; a Spell Counter prepares casting', () => {
  const { run } = mounted(2);
  const context = { registries, player: run, combatExpansionVersion: 2, breakMeterVersion: 2 };
  const dodge = resolveCombatCard(context, { cardId: 'dodgeRoll' });
  assert.deepEqual([route(dodge, run, 2).group, route(dodge, run, 2).technique], ['defend', 'guard']);
  const dagger = resolveCombatCard(context, { cardId: 'rondelParry' });
  const parry = resolveCombatAnimation(dagger, [{ id: 'parryDagger' }], { combatExpansionVersion: 2 });
  assert.deepEqual([parry.group, parry.technique, parry.rest], ['defend', 'guard', 'guard']);
  const spell = resolveCombatCard(context, { cardId: 'barrageCounter' });
  const plan = route(spell, run, 2);
  assert.deepEqual([plan.group, plan.technique, plan.rest, plan.family], ['cast', 'cast', 'cast', 'spell']);
});

test('legacy kind priority and ordinary Power preparation stay unchanged', () => {
  const counterAttack = { kindIds: ['classification.attack'], cardTags: ['maneuver:counter', 'camp:physical', 'guard'] };
  assert.equal(resolveCombatAnimation(counterAttack).group, 'attack', 'omitted version remains legacy');
  assert.equal(resolveCombatAnimation(counterAttack, [], { combatExpansionVersion: 1 }).group, 'attack');
  const power = { kindIds: ['classification.power'], cardTags: ['guard'] };
  assert.deepEqual(resolveCombatAnimation(power, [], { combatExpansionVersion: 2 }), resolveCombatAnimation(power));
  assert.equal(resolveCombatAnimation(power).technique, 'power');
});

