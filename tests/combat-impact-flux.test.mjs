// Reaction rules version 2: Impact (Poise), Flux (Ward), Counterstrike on counter returns,
// the Defend trait guard and status Flux (docs/combat-card-traits-contract.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { enqueueExpandedAction } from '../src/engine/combatExpansionActions.js';
import { executeAction } from '../src/engine/actions.js';
import { applyStatus } from '../src/engine/statuses.js';
import { fireOwnerHooks } from '../src/engine/triggers.js';
import { armCombatCounter, beginTacticalAction, completeTacticalAction, recordTacticalContact,
  setCombatStance, startTacticalTurn } from '../src/engine/combatMatchups.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';

const registries = createRegistries(contentBundle);
const PHYSICAL = { camp: 'physical', maneuver: 'attack', damageType: 'slash', reach: 'contact', targeting: 'single' };

function fixture({ version = 2, enemies = 1 } = {}) {
  const combat = createCombat({ registries, rng: createRng(901), combatExpansionVersion: 2, reactionRulesVersion: version,
    enemyIds: Array(enemies).fill('wanderingSoldier'),
    player: { classId: 'reaver', maxHp: 100, hp: 100, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10,
      energyMax: 10, drawPerTurn: 1, deck: [] } });
  for (const enemy of combat.enemies) {
    enemy.block = enemy.barrier = 0;
    enemy.hp = enemy.maxHp = 500;
    enemy.damageResistanceFlat = {}; enemy.damageWeaknessPercent = {};
    enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 100, ward: 3 };
    delete enemy.combatCounter; delete enemy.combatEvade; delete enemy.combatStance;
    enemy.poiseMeter = { value: 0, max: 100000 };
    enemy.persistentWard.value = enemy.persistentWard.max = 10;
  }
  combat.player.persistentWard = { value: 10, max: 10 };
  const events = [];
  const emit = combat.emit;
  combat.emit = (type, payload) => { events.push({ type, ...payload }); return emit(type, payload); };
  return { combat, enemies: combat.enemies, events };
}

const drain = combat => { while (combat.queue.length) executeAction(combat, combat.queue.shift()); };
const damage = (amount, extra = {}) => ({ op: 'damage', target: 'enemy', amount, ...extra });

// Plays one card's effects against one enemy through the expansion group, as a card play does.
function play(combat, enemy, { effects, traitValues, type = 'attack', profile = PHYSICAL }) {
  const carrier = { cardId: 'testCard', instanceId: 'test-card', type, combatProfile: profile, combatRiderTargets: [],
    ...(traitValues ? { traitValues } : {}) };
  const actions = effects.map(effect => ({ effect, source: combat.player, owner: combat.player, target: enemy, card: carrier, meta: {} }));
  enqueueExpandedAction(combat, actions, { source: combat.player, target: enemy, carrier });
  drain(combat);
}

// Runs one scenario on a fresh fight with a fixed seed and reports each enemy's change.
function outcome({ version = 2, effects, traitValues, type, profile, enemies = 1, before = () => {} } = {}) {
  const f = fixture({ version, enemies });
  before(f);
  const poise = f.enemies.map(enemy => enemy.poiseMeter.value);
  const ward = f.enemies.map(enemy => enemy.persistentWard.value);
  const hp = f.enemies.map(enemy => enemy.hp);
  play(f.combat, f.enemies[0], { effects, traitValues, type, profile });
  return { ...f, poise: f.enemies.map((enemy, i) => enemy.poiseMeter.value - poise[i]),
    ward: f.enemies.map((enemy, i) => ward[i] - enemy.persistentWard.value),
    hit: f.enemies.map((enemy, i) => hp[i] - enemy.hp) };
}

test('Impact adds N Poise to a hit target that dealt no Poise of its own', () => {
  const base = outcome({ effects: [damage(5)] });
  const traited = outcome({ effects: [damage(5)], traitValues: { impact: 2 } });
  assert.ok(traited.hit[0] > 0, 'the strike connected');
  assert.equal(traited.poise[0] - base.poise[0], 2);
  assert.equal(traited.events.filter(event => event.type === 'combatImpactApplied')[0].doubled, false);
});

test('Impact doubles the card own Poise: 3 own Poise becomes 6 in total', () => {
  const effects = [damage(5), { op: 'poiseDamage', target: 'enemy', amount: 3 }];
  const base = outcome({ effects });
  const traited = outcome({ effects, traitValues: { impact: 2 } });
  assert.equal(base.poise[0], 3);
  assert.equal(traited.poise[0], 6);
  const applied = traited.events.filter(event => event.type === 'combatImpactApplied');
  assert.deepEqual(applied.map(event => [event.amount, event.doubled]), [[3, true]]);
});

test('Impact applies once per target on an area hit with several contacts', () => {
  const effects = [{ op: 'damage', target: 'allEnemies', amount: 5, hits: 2 }];
  const base = outcome({ effects, enemies: 2 });
  const traited = outcome({ effects, traitValues: { impact: 2 }, enemies: 2 });
  assert.ok(traited.hit.every(hit => hit > 0));
  assert.deepEqual(traited.poise.map((poise, i) => poise - base.poise[i]), [2, 2]);
  assert.equal(traited.events.filter(event => event.type === 'combatImpactApplied').length, 2);
});

test('an evaded hit gives no Impact or Flux', () => {
  const evade = { before: f => { f.enemies[0].combatEvade = { charges: 1, bonus: 1000, advantage: false, disadvantage: false, expiresOnOwnerCycle: 99 }; } };
  const base = outcome({ effects: [damage(5)], ...evade });
  const traited = outcome({ effects: [damage(5)], traitValues: { impact: 2, flux: 1 }, ...evade });
  assert.equal(traited.hit[0], 0, 'the strike was avoided');
  assert.equal(traited.poise[0], base.poise[0]);
  assert.equal(traited.ward[0], 0);
  assert.equal(traited.events.filter(event => /combat(Impact|Flux)Applied/.test(event.type)).length, 0);
});

test('a fully blocked hit still gives Impact', () => {
  const blocked = { before: f => { f.enemies[0].block = 1000; } };
  const traited = outcome({ effects: [damage(5)], traitValues: { impact: 2 }, ...blocked });
  assert.equal(traited.hit[0], 0, 'Block absorbed the whole hit');
  assert.equal(traited.poise[0], 2);
});

test('Flux adds N Ward to a hit target and doubles its own Ward', () => {
  const base = outcome({ effects: [damage(5)] });
  const plain = outcome({ effects: [damage(5)], traitValues: { flux: 1 } });
  assert.equal(plain.ward[0] - base.ward[0], 1);
  const effects = [damage(5), { op: 'wardDamage', target: 'enemy', amount: 2 }];
  const doubled = outcome({ effects, traitValues: { flux: 1 } });
  assert.equal(outcome({ effects }).ward[0], 2);
  assert.equal(doubled.ward[0], 4);
  assert.deepEqual(doubled.events.filter(event => event.type === 'combatFluxApplied').map(event => [event.amount, event.doubled]), [[2, true]]);
});

test('a Power with Flux deals its Ward to every living enemy when played', () => {
  const effects = [{ op: 'applyStatus', target: 'enemy', status: 'burn', stacks: 1 }];
  const base = outcome({ effects, type: 'power', enemies: 2 });
  const traited = outcome({ effects, type: 'power', traitValues: { flux: 2 }, enemies: 2 });
  assert.deepEqual(traited.ward.map((ward, i) => ward - base.ward[i]), [2, 2]);
});

test('reaction rules version 1 ignores trait values entirely', () => {
  const effects = [damage(5), { op: 'poiseDamage', target: 'enemy', amount: 3 }, { op: 'wardDamage', target: 'enemy', amount: 2 }];
  const plain = outcome({ version: 1, effects });
  const traited = outcome({ version: 1, effects, traitValues: { impact: 2, flux: 1 } });
  assert.deepEqual(traited.poise, plain.poise);
  assert.deepEqual(traited.ward, plain.ward);
  assert.deepEqual(traited.hit, plain.hit);
  assert.equal(traited.events.filter(event => /combat(Impact|Flux)Applied/.test(event.type)).length, 0);
});

test('burn ticks Ward 1 at its owner turn start under version 2 and nothing under version 1', () => {
  for (const [version, expected] of [[2, 9], [1, 10]]) {
    const { combat } = fixture({ version });
    applyStatus(combat, combat.player, 'burn', 1);
    fireOwnerHooks(combat, combat.player, 'ownerTurnStart');
    assert.equal(combat.player.persistentWard.value, expected, `version ${version}`);
  }
});
