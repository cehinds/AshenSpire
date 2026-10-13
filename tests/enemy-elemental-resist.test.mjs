// Enemy elemental resist (design elements-and-tag-mechanics §3): a percent map
// beside `weak`, applied as ceil(total * (1 + weak/100) * (1 - resist/100)) - flat
// on every v2 damage path. Preview equals the hit, solo equals co-op.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createCoopCombat, playCard, previewCoopCard } from '../src/engine/coopCombat.js';
import { createRng } from '../src/engine/rng.js';
import { createCombatExpansionRuleSnapshot, combatExpansionRulesProblems } from '../src/model/combatExpansionRules.js';
import { expandedEnemyProjection, typedDefenseAmount } from '../src/engine/combatExpansionEquipment.js';

const registries = createRegistries({ ...contentBundle, cards: contentBundle.cards.map(card => card.id === 'starstonePebble'
  ? { ...card, effects: [{ op: 'damage', target: 'enemy', amount: 9 }], cost: 0, manaCost: 0, upgrade: undefined } : card) });
const player = { classId: 'starseer', maxHp: 100, hp: 100, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10,
  energyMax: 10, drawPerTurn: 1, relicIds: [], combatExpansionVersion: 2,
  deck: [{ cardId: 'starstonePebble', instanceId: 'pebble', upgraded: false }] };

function rulesWith(resist) {
  const rules = createCombatExpansionRuleSnapshot();
  rules.equipment.enemies.wanderingSoldier = { ...rules.equipment.enemies.wanderingSoldier, weak: {}, flat: {}, ...(resist ? { resist } : {}) };
  return rules;
}

function calm(enemy) {
  enemy.block = enemy.barrier = 0; enemy.hp = enemy.maxHp = 500;
  enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 100, ward: 0 };
  delete enemy.combatCounter; delete enemy.combatEvade; delete enemy.combatStance;
  if (enemy.persistentWard) enemy.persistentWard.value = enemy.persistentWard.max = 0;
}

function hit(resist, coop) {
  const combatExpansionRules = rulesWith(resist);
  const combat = coop
    ? createCoopCombat({ registries, rng: createRng(801), players: [{ ...player, id: 'a' }, { ...player, id: 'b' }], enemyIds: ['wanderingSoldier'], combatExpansionRules })
    : createCombat({ registries, rng: createRng(801), combatExpansionVersion: 2, combatExpansionRules, enemyIds: ['wanderingSoldier'], player });
  const enemy = combat.enemies[0]; calm(enemy);
  const id = coop ? combat.players.get('a').piles.hand[0].instanceId : 'pebble';
  const preview = coop ? previewCoopCard(combat, 'a', id, enemy.id) : previewCard(combat, id, enemy.id);
  const before = enemy.hp;
  if (coop) playCard(combat, 'a', id, enemy.id); else dispatch(combat, { type: 'playCard', cardInstanceId: id, targetId: enemy.id });
  const event = combat.eventLog.find(row => row.type === 'damageDealt' && row.targetId === enemy.id);
  return { dealt: before - enemy.hp, shown: preview.values.find(row => row.op === 'damage').totalDamage, type: event?.damageType };
}

test('a 50 resist halves (ceil) that type, leaves other types whole, and preview equals the hit solo and co-op', () => {
  const base = hit(null, false);
  assert.ok(base.dealt > 0 && base.type, 'baseline hit lands');
  assert.equal(base.shown, base.dealt);
  const stable = { cold: 'frost', force: 'arcane', holy: 'sacred', necrotic: 'decay' }[base.type] || base.type;
  for (const coop of [false, true]) {
    const resisted = hit({ [stable]: 50 }, coop);
    assert.equal(resisted.dealt, Math.ceil(base.dealt * 0.5), `${coop ? 'co-op' : 'solo'} halves ${stable}`);
    assert.equal(resisted.shown, resisted.dealt, `${coop ? 'co-op' : 'solo'} preview equals the hit`);
    const other = hit({ [stable === 'fire' ? 'frost' : 'fire']: 50 }, coop);
    assert.equal(other.dealt, base.dealt, 'resist to another type changes nothing');
  }
});

test('the typed-defense line multiplies weak and resist before flat, and caps resist at 75', () => {
  assert.equal(typedDefenseAmount({ damageWeaknessPercent: { fire: 25 }, damageResistPercent: { fire: 50 }, damageResistanceFlat: { fire: 1 } }, 'fire', 10), 6);
  assert.equal(typedDefenseAmount({ damageResistPercent: { fire: 100 } }, 'fire', 8), 2);
  assert.equal(expandedEnemyProjection('wanderingSoldier', rulesWith({ fire: 90 }).equipment).damageResistPercent.fire, 75);
  assert.deepEqual(expandedEnemyProjection('wanderingSoldier', rulesWith(null).equipment).damageResistPercent, {});
});

test('the validator accepts resist, refuses resist over the cap and resist on a type the row is weak to', () => {
  assert.deepEqual(combatExpansionRulesProblems(rulesWith({ fire: 50 })), []);
  const over = rulesWith({ fire: 80 });
  assert.ok(combatExpansionRulesProblems(over).some(problem => /resist\.fire cannot exceed 75/.test(problem)));
  const both = rulesWith({ fire: 25 }); both.equipment.enemies.wanderingSoldier.weak = { fire: 25 };
  assert.ok(combatExpansionRulesProblems(both).some(problem => /resist\.fire contradicts its weakness/.test(problem)));
  const bad = rulesWith({ fire: -5 });
  assert.ok(combatExpansionRulesProblems(bad).some(problem => /resist must contain non-negative/.test(problem)));
});

// The five authored enemy resists (design section 3, decision #6).
const AUTHORED = {
  charredColossus: { fire: 50 }, ashheartDragon: { fire: 25 }, courtMarionette: { psychic: 50 },
  thornMatriarch: { earth: 50 }, marrowOrganist: { decay: 50 },
};

test('each of the five authored enemies projects its resist, and the shipped rules validate', () => {
  const rules = createCombatExpansionRuleSnapshot();
  assert.deepEqual(combatExpansionRulesProblems(rules), []);
  for (const [enemyId, resist] of Object.entries(AUTHORED)) {
    assert.deepEqual(expandedEnemyProjection(enemyId, rules.equipment).damageResistPercent, resist, enemyId);
  }
});

test('no enemy resists a type it is weak to', () => {
  const { enemies } = createCombatExpansionRuleSnapshot().equipment;
  for (const [enemyId, row] of Object.entries(enemies)) {
    for (const type of Object.keys(row.resist || {})) assert.equal(row.weak?.[type], undefined, `${enemyId} ${type}`);
  }
});

// A solo v2 hit of plain 10-damage fire (cinderSigil, school fire) on one enemy.
function fireHit(enemyId, { dropResist = false } = {}) {
  const fireRegistries = createRegistries({ ...contentBundle, cards: contentBundle.cards.map(card => card.id === 'cinderSigil'
    ? { ...card, effects: [{ op: 'damage', target: 'enemy', amount: 10 }], cost: 0, manaCost: 0, upgrade: undefined } : card) });
  const rules = createCombatExpansionRuleSnapshot();
  if (dropResist) delete rules.equipment.enemies[enemyId].resist;
  const fireCombat = createCombat({ registries: fireRegistries, rng: createRng(802), combatExpansionVersion: 2, combatExpansionRules: rules,
    enemyIds: [enemyId], player: { ...player, deck: [{ cardId: 'cinderSigil', instanceId: 'sigil', upgraded: false }] } });
  const enemy = fireCombat.enemies[0]; calm(enemy);
  const preview = previewCard(fireCombat, 'sigil', enemy.id);
  const before = enemy.hp;
  dispatch(fireCombat, { type: 'playCard', cardInstanceId: 'sigil', targetId: enemy.id });
  const event = fireCombat.eventLog.find(row => row.type === 'damageDealt' && row.targetId === enemy.id);
  return { dealt: before - enemy.hp, shown: preview.values.find(row => row.op === 'damage').totalDamage, type: event?.damageType };
}

test('a fire hit is ceil-halved by charredColossus (fire 50) and ceil-quartered by ashheartDragon (fire 25); preview equals the hit', () => {
  const colossusFull = fireHit('charredColossus', { dropResist: true }).dealt;
  const dragonFull = fireHit('ashheartDragon', { dropResist: true }).dealt;
  assert.ok(colossusFull > 0 && dragonFull > 0, 'baseline hits land');
  const colossus = fireHit('charredColossus');
  assert.equal(colossus.type, 'fire');
  assert.equal(colossus.dealt, Math.ceil(colossusFull * 0.5));
  assert.ok(colossus.dealt < colossusFull, 'the resist lowers the same enemy\'s hit');
  assert.equal(colossus.shown, colossus.dealt);
  const dragon = fireHit('ashheartDragon');
  assert.equal(dragon.dealt, Math.ceil(dragonFull * 0.75));
  assert.equal(dragon.shown, dragon.dealt);
});
