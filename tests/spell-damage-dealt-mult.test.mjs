// `spellDamageDealtMult` (design elements-and-tag-mechanics §2.4) and the
// Silenced status that uses it: spell-camp damage its owner deals is scaled,
// physical damage is not; the preview and the hit agree in v1 and v2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { computeAttackDamage, spellDamageDealtMultiplier } from '../src/engine/actions.js';

const base = createRegistries(contentBundle);
const spell = { combatProfile: { camp: 'spell', maneuver: 'casting', school: 'force', damageType: 'arcane' } };
const physical = { combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing' } };

// MODIFIER_KEYS is deliberately not imported: tools/closedsets.mjs --selftest
// plants it as import-only in src/engine/statuses.js and expects no other reader.
// The halving asserted below only happens when the key is in that closed set.
test('Silenced is a registered status using the closed spellDamageDealtMult modifier', () => {
  const row = base.statuses.get('silenced');
  assert.equal(row.modifiers.spellDamageDealtMult, 0.5);
  assert.deepEqual(row.decay, { duration: 2 });
});

test('a silenced attacker deals half spell-camp damage and full physical damage (v1 math)', () => {
  const combat = createCombat({ registries: base, rng: createRng(5), enemyIds: ['wanderingSoldier'],
    player: { classId: 'starseer', maxHp: 80, hp: 80, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1, deck: [{ cardId: 'starstonePebble', instanceId: 'p', upgraded: false }] } });
  const enemy = combat.enemies[0];
  enemy.statuses = { ...enemy.statuses, silenced: { stacks: 1, duration: 2 } };
  assert.equal(spellDamageDealtMultiplier(combat, enemy, spell), 0.5);
  assert.equal(spellDamageDealtMultiplier(combat, enemy, physical), 1);
  assert.equal(computeAttackDamage(combat, enemy, null, 10, [], spell, { matchups: false }), 5);
  assert.equal(computeAttackDamage(combat, enemy, null, 10, [], physical, { matchups: false }), 10);
  delete enemy.statuses.silenced;
  assert.equal(computeAttackDamage(combat, enemy, null, 10, [], spell, { matchups: false }), 10);
});

test('v2: a silenced player casting a spell card deals half, and preview equals the hit', () => {
  const registries = createRegistries({ ...contentBundle, cards: contentBundle.cards.map(card => card.id === 'starstonePebble'
    ? { ...card, effects: [{ op: 'damage', target: 'enemy', amount: 10 }], cost: 0, manaCost: 0, upgrade: undefined } : card) });
  const run = silenced => {
    const combat = createCombat({ registries, rng: createRng(801), combatExpansionVersion: 2, enemyIds: ['wanderingSoldier'],
      player: { classId: 'starseer', maxHp: 100, hp: 100, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10,
        drawPerTurn: 1, deck: [{ cardId: 'starstonePebble', instanceId: 'pebble', upgraded: false }] } });
    const enemy = combat.enemies[0];
    enemy.block = enemy.barrier = 0; enemy.hp = enemy.maxHp = 500;
    enemy.damageResistanceFlat = {}; enemy.damageWeaknessPercent = {}; enemy.damageResistPercent = {};
    enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 100, ward: 0 };
    delete enemy.combatCounter; delete enemy.combatEvade; delete enemy.combatStance;
    if (enemy.persistentWard) enemy.persistentWard.value = enemy.persistentWard.max = 0;
    if (silenced) combat.player.statuses.silenced = { stacks: 1, duration: 2 };
    const shown = previewCard(combat, 'pebble', enemy.id).values.find(row => row.op === 'damage').totalDamage;
    const before = enemy.hp;
    dispatch(combat, { type: 'playCard', cardInstanceId: 'pebble', targetId: enemy.id });
    return { shown, dealt: before - enemy.hp };
  };
  const loud = run(false), quiet = run(true);
  assert.ok(loud.dealt > 0);
  assert.equal(quiet.dealt, Math.floor(loud.dealt / 2));
  assert.equal(quiet.shown, quiet.dealt);
});
