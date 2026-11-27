import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplyGearCardRules } from '../src/model/gearEffects.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { stanceOf } from '../src/model/stanceRules.js';
import { core2Registries } from './helpers/core2.mjs';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { cardPlayCosts, dispatch } from '../src/engine/combat.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';

const spell = {
  id: 'qa.reach-spell', type: 'attack', cost: 1, staminaCost: 1, manaCost: 1,
  tags: ['camp:spell', 'source:spell', 'maneuver:casting', 'school:force', 'range:reach', 'targeting:single', 'counter:spell', 'trait:reaction'],
  effects: [{ op: 'damage', target: 'enemy', amount: 9 }], keywords: [],
};
const bonus = [{ selector: 'spell', arg: null, conds: [], stat: 'damage', mode: 'add', amount: 1, source: 'qa-focus' }];

test('a gear projection materializing a tagged range keeps the complete spell identity', () => {
  const before = structuredClone(spell);
  const projected = ApplyGearCardRules(bonus, spell);
  assert.deepEqual(projected.combatProfile, combatProfileFor(spell));
  assert.deepEqual(stanceOf(projected), { maneuver: 'casting', camp: 'spell', range: 'reach', school: 'force' });
  assert.deepEqual(projected.combatProfile.traits, ['reaction']);
  assert.equal(projected.combatProfile.counterMode, 'spell');
  assert.equal(projected.effects[0].amount, 10);
  assert.deepEqual(spell, before, 'identity inference and the gear bonus never mutate the source');
});

for (const overrides of [
  { school: 'frost', counterCoverage: { camps: ['spell'] }, counterPayload: { ward: 2 } },
  { camp: 'physical', maneuver: 'counter', school: 'earth', targeting: 'area', traits: ['impact'], counterMode: 'melee', range: 'melee' },
]) test(`an authored ${overrides.camp ? 'full' : 'partial'} combat profile overrides inferred identity while the projected range wins`, () => {
  const authored = { ...structuredClone(spell), combatProfile: structuredClone(overrides) };
  const before = structuredClone(authored);
  const projected = ApplyGearCardRules(bonus, authored);
  assert.deepEqual(projected.combatProfile, { ...combatProfileFor(authored), ...overrides, range: 'reach' });
  assert.deepEqual(authored, before);
});

const registries = core2Registries();
for (const cardId of ['core.meteor', 'custom.copy_mwx6hh79']) test(`${cardId}: Prepared keeps the authored spell identity and pays one Graduate cut plus independent robe/Focus cuts`, () => {
  for (const [hand, focus] of [['greatsword', 0], ['ashStaff', 1]]) {
    const run = createRunState({ registries, classId: 'starseer', seed: 29,
      profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['one'] } } } });
    run.loadout.sets.rightHand[0] = hand; run.loadout.sets.leftHand[0] = null;
    const combat = createRunCombat({ registries, run, rng: createRng(29), enemyIds: ['wanderingSoldier'] });
    combat.player.stamina = combat.player.maxStamina = 20;
    combat.player.mana = combat.player.maxMana = 20;
    combat.player.combatStance = { maneuver: 'prepared', camp: 'spell' };
    combat.piles.hand = [{ cardId, instanceId: 'range-identity' }];
    const authored = combat.gameProfile.content.cards.find(card => card.id === cardId);
    const resolved = resolveCombatCard(combat, combat.piles.hand[0]);
    assert.equal(stanceOf(resolved).camp, 'spell');
    assert.equal(stanceOf(resolved).school, combatProfileFor(authored).school);
    const expected = {
      // Owner 2026-11-26: no spell surcharge; Prepared takes SP to max(SP - 1, 1) without raising a price at or under 1, and no Mana.
      energy: authored.staminaCost > 1 ? authored.staminaCost - 1 : authored.staminaCost,
      stamina: authored.staminaCost > 1 ? authored.staminaCost - 1 : authored.staminaCost,
      mana: Math.max(0, Math.max(0, authored.manaCost - 1) - 1 - focus),
    };
    const quote = cardPlayCosts(combat, 'range-identity');
    assert.deepEqual(quote, expected, `${cardId}/${hand}: authored price, Graduate, robe, Focus`);
    const played = dispatch(combat, { type: 'playCard', cardInstanceId: 'range-identity', targetId: combat.enemies[0].id });
    assert.equal(played.events.find(event => event.type === 'cardPlayed').manaSpent, expected.mana);
  }
});
