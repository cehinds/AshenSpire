import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { enqueueExpandedAction } from '../src/engine/combatExpansionActions.js';
import { executeAction, applyAttackDamage } from '../src/engine/actions.js';
import { schoolResistanceMultiplier, persistentWardMaximum } from '../src/model/combatRatings.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';

const drainQueue = combat => { while (combat.queue.length) executeAction(combat, combat.queue.shift()); };

function fixture(effects = [{ op: 'damage', target: 'enemy', amount: 5, hits: 2 }]) {
  const registries = createRegistries({ ...contentBundle, cards: contentBundle.cards.map(card => card.id === 'starstonePebble'
    ? { ...card, effects, cost: 0, manaCost: 0, upgrade: undefined } : card) });
  const combat = createCombat({ registries, rng: createRng(801), combatExpansionVersion: 2,
    enemyIds: ['wanderingSoldier'], player: { classId: 'starseer', maxHp: 100, hp: 100,
      maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1,
      deck: [{ cardId: 'starstonePebble', instanceId: 'paired', upgraded: false }] } });
  const enemy = combat.enemies[0]; enemy.block = enemy.barrier = 0;
  enemy.damageResistanceFlat = {}; enemy.damageWeaknessPercent = {};
  enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 100, ward: 3 };
  delete enemy.combatCounter; delete enemy.combatEvade; delete enemy.combatStance;
  enemy.persistentWard.value = enemy.persistentWard.max = 3;
  return { combat, enemy, registries };
}

test('whole Spell action applies persistent Ward once across hits, spends it, and preview matches the committed budget', () => {
  const { combat, enemy } = fixture();
  const counters = combat.rng.getCounters();
  const preview = previewCard(combat, 'paired', enemy.id);
  assert.deepEqual(combat.rng.getCounters(), counters, 'preview consumes no streams');
  const value = preview.values.find(row => row.op === 'damage').totalDamage;
  const before = enemy.hp;
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: 'paired', targetId: enemy.id });
  const damage = out.events.filter(event => event.type === 'damageDealt' && event.targetId === enemy.id);
  assert.equal(before - enemy.hp, value);
  assert.equal(damage.reduce((sum, event) => sum + event.wardResisted, 0), 3);
  assert.equal(enemy.persistentWard.value, 0, 'Ward is spent by the damage it absorbs');
});

test('paused action receipts are interned after JSON restore and finish without repeating a charge or roll', () => {
  const { combat, enemy, registries } = fixture();
  const carrier = { cardId: 'starstonePebble', tags: ['camp:spell', 'maneuver:casting'],
    combatProfile: { camp: 'spell', maneuver: 'casting', school: 'force', damageType: 'blunt', reach: 'near', targeting: 'single' } };
  const actions = [1, 2].map(() => ({ effect: { op: 'damage', target: 'enemy', amount: 2 }, source: combat.player, owner: combat.player, target: enemy, card: carrier, meta: {} }));
  enqueueExpandedAction(combat, actions, { source: combat.player, target: enemy, carrier });
  combat.pendingAbilityDiscard = { count: 1 };
  combat.pendingAbilityPlay = { instance: { instanceId: 'paid', cardId: 'starstonePebble', upgraded: false }, ref: carrier };
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  const restored = restoreCombatSnapshot({ registries, rng: createRng(combat.rng.seed, combat.rng.getCounters()), snapshot: saved });
  assert.equal(restored.queue[0].meta.expansionGroup, restored.queue[1].meta.expansionGroup);
  assert.equal(restored.queue[0].meta.expansionGroup, restored.queue[2].meta.expansionGroup);
  assert.equal(restored.pendingExpansionActions, 1);
  delete restored.pendingAbilityDiscard;
  drainQueue(restored);
  assert.equal(restored.pendingExpansionActions, 0);
});

test('next-roll advantage and Retain hooks use saved finite owner budgets', () => {
  const { combat } = fixture([]);
  combat.enqueue({ effect: { op: 'grantRollMode', target: 'self', roll: 'evade', advantage: true }, source: combat.player, target: combat.player });
  combat.enqueue({ effect: { op: 'retain', amount: 1 }, source: combat.player, owner: combat.player });
  drainQueue(combat);
  assert.equal(combat.player.nextEvadeMode.advantage, true);
  assert.deepEqual(combat.player.combatRetainedCards, ['paired']);
  assert.equal(serializeCombatSnapshot(combat).player.nextEvadeMode.advantage, true);
});


test('mixed Martial and Spell contacts are refused before planning or spending randomness', () => {
  const { combat, enemy } = fixture([]);
  const before = { counters: combat.rng.getCounters(), serial: combat.expansionActionSerial, queue: combat.queue.length };
  const carrier = { cardId: 'starstonePebble', combatProfile: { camp: 'spell', maneuver: 'casting', reach: 'near', targeting: 'single' } };
  assert.throws(() => enqueueExpandedAction(combat, [{ effect: { op: 'damage', target: 'enemy', amount: 5,
    combatProfile: { camp: 'physical' } }, source: combat.player, target: enemy, card: carrier }],
    { source: combat.player, target: enemy, carrier }), /camp|Martial|Spell/i);
  assert.deepEqual(combat.rng.getCounters(), before.counters);
  assert.equal(combat.expansionActionSerial, before.serial);
  assert.equal(combat.queue.length, before.queue);
});

test('expanded critical hits multiply once and still announce the original multiplier', () => {
  const { combat, enemy } = fixture([{ op: 'damage', target: 'enemy', amount: 5, tags: ['testCritical'] }]);
  combat.player.critRules = [{ tags: ['testCritical'], base: 1, cap: 1, multiplier: 2 }];
  enemy.persistentWard.value = 0;
  const before = enemy.hp;
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: 'paired', targetId: enemy.id });
  assert.equal(before - enemy.hp, 10);
  assert.equal(out.events.filter(event => event.type === 'critHit').length, 1);
  assert.equal(out.events.find(event => event.type === 'critHit').multiplier, 2);
});


test('un-aimed card faces show offense while target inspection shows Ward mitigation down to 1', () => {
  const { combat, enemy } = fixture([{ op: 'damage', target: 'enemy', amount: 5 }]);
  enemy.persistentWard.value = enemy.persistentWard.max = 20;
  const unAimed = previewCard(combat, 'paired');
  const aimed = previewCard(combat, 'paired', enemy.id);
  const row = unAimed.values.find(value => value.op === 'damage');
  assert.equal(unAimed.tokens[row.token], 5);
  assert.equal(row.perTarget[enemy.id], 1, 'Ward always lets at least 1 damage through');
  assert.equal(aimed.tokens[row.token], 1);
});

test('Ward reduces a physical hit, Block soaks the rest, then Health', () => {
  const { combat, enemy } = fixture([{ op: 'damage', target: 'enemy', amount: 10 }]);
  enemy.persistentWard.value = enemy.persistentWard.max = 4;
  enemy.ratings.poise = 0; enemy.block = 3;
  const carrier = { cardId: 'strike', damageSchool: 'physical', tags: ['camp:physical', 'maneuver:attack'],
    combatProfile: { camp: 'physical', maneuver: 'attack', school: 'physical', damageType: 'slashing', reach: 'contact', targeting: 'single' } };
  const before = enemy.hp;
  const amount = applyAttackDamage(combat, combat.player, enemy, 10, [], carrier);
  assert.equal(amount, 6, 'Ward absorbs 4 of 10');
  assert.equal(enemy.persistentWard.value, 0);
  assert.equal(enemy.block, 0, 'Block soaks 3');
  assert.equal(before - enemy.hp, 3);
});

test('a resistant creature takes floor(0.75 × damage) by default, configurable down to 0.5', () => {
  const { combat, enemy } = fixture([{ op: 'damage', target: 'enemy', amount: 10 }]);
  enemy.persistentWard.value = enemy.persistentWard.max = 0;
  enemy.damageResistanceBySchool = { magic: 10 };
  assert.equal(schoolResistanceMultiplier(combat, enemy, 'magic'), 0.75);
  assert.equal(schoolResistanceMultiplier(combat, enemy, 'fire'), 1);
  assert.equal(schoolResistanceMultiplier({ ratingsRules: { resistance: { schoolTaken: 0.5 } } }, enemy, 'magic'), 0.5);
  assert.equal(schoolResistanceMultiplier({ ratingsRules: { resistance: { schoolTaken: 0.01 } } }, enemy, 'magic'), 0.1, 'never past 90% resistance');
});

test('a combatant starts with half its Ward rating as its Ward pool', () => {
  assert.equal(persistentWardMaximum({}, { ratings: { ward: 25 } }), 12);
  assert.equal(persistentWardMaximum({ ratingsRules: { resistance: { wardPool: 1 } } }, { ratings: { ward: 25 } }), 25);
});
