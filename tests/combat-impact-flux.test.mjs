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
    enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 0, ward: 10 };
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

test('Impact counts only the own Poise that passed a Poise guard', () => {
  // A 4-Poise guard swallows the card's own 4 Poise, so Impact falls back to N instead of doubling 4.
  const effects = [damage(5), { op: 'poiseDamage', target: 'enemy', amount: 4 }];
  const guard = { before: f => { f.enemies[0].poiseGuard = 4; } };
  const traited = outcome({ effects, traitValues: { impact: 1 }, ...guard });
  const applied = traited.events.filter(event => event.type === 'combatImpactApplied');
  assert.deepEqual(applied.map(event => [event.amount, event.doubled]), [[1, false]]);
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

// A player Counter armed with a fixed payload, then one enemy hit that Block fully absorbs.
function counterReturn({ version = 2, traitValues, payload = { hp: 10, poise: 4, ward: 2 }, mode, incoming = PHYSICAL,
  incomingBlock = 8, maneuver = 'counter', profile = PHYSICAL, coverage } = {}) {
  const f = fixture({ version });
  const { combat } = f;
  const enemy = f.enemies[0];
  const counter = { cardId: 'testCounter', instanceId: 'test-counter', type: 'skill',
    combatProfile: { ...profile, maneuver, ...(mode === 'spell' ? { camp: 'spell', school: 'fire' } : {}) },
    combatRiderTargets: [], ...(traitValues ? { traitValues } : {}) };
  setCombatStance(combat, combat.player, counter);
  armCombatCounter(combat, combat.player, counter, { payload, ...(mode ? { mode } : {}), ...(coverage ? { coverage } : {}) });
  const receipt = beginTacticalAction(combat, enemy, combat.player, { combatProfile: incoming }, [{ amount: 8 }]);
  recordTacticalContact(receipt, { blocked: incomingBlock });
  const poise = enemy.poiseMeter.value, ward = enemy.persistentWard.value, hp = enemy.hp;
  completeTacticalAction(combat, enemy, combat.player, { combatProfile: incoming }, receipt);
  drain(combat);
  return { ...f, poise: enemy.poiseMeter.value - poise, ward: ward - enemy.persistentWard.value, hp: hp - enemy.hp };
}

test('a Counter return without trait values keeps SPEC 4.8 reply Poise and Ward', () => {
  const plain = counterReturn();
  assert.equal(plain.hp, 10);
  assert.equal(plain.poise, 4);
  assert.equal(plain.ward, 2);
});

test('Counterstrike scales the authored return before Impact and Flux double it', () => {
  // Counter against an Attack: 75% advantage. hp 10 -> 17, poise 4 -> 7, ward 2 -> 3, then Impact and Flux.
  const traited = counterReturn({ traitValues: { counterstrike: true, impact: 2, flux: 1 } });
  assert.equal(traited.hp, 17);
  assert.equal(traited.poise, 14);
  assert.equal(traited.ward, 6);
});

test('Counterstrike scales the authored hp base, not its rating bonus or other bonuses', () => {
  // hp 13 = base 10 + rating 1 + flat bonus 2. 75%: base 10 -> 17, rating re-derived from 17 (0 in this
  // fixture, which carries no damage rating), flat bonus 2 unscaled -> 19; scaling all 13 would give 22.
  const traited = counterReturn({ traitValues: { counterstrike: true }, payload: { hp: 13, poise: 0, ward: 0, hpBase: 10, hpRating: 1 } });
  assert.equal(traited.hp, 19);
});

test('Counterstrike scales only the authored Counter Poise, not a charge on top', () => {
  // poise 6 = authored 4 + a 2-Poise Break charge. 75% (Counter vs Attack): 4 -> 7, charge 2 unscaled -> 9.
  const traited = counterReturn({ traitValues: { counterstrike: true }, payload: { hp: 0, poise: 6, ward: 0, poiseBase: 4 } });
  assert.equal(traited.poise, 9);
});

test('Impact gives N reply Poise to a Counter whose return has none', () => {
  const traited = counterReturn({ traitValues: { impact: 2, flux: 1 }, payload: { hp: 10, poise: 0, ward: 0 } });
  assert.equal(traited.poise, 2);
  assert.equal(traited.ward, 1);
});

test('a Spell Counter against a physical projectile keeps no reply Poise, even with Impact', () => {
  const projectile = { camp: 'physical', maneuver: 'ranged', delivery: 'projectile', reach: 'far', targeting: 'single', damageType: 'piercing' };
  // The card authors coverage of physical projectiles as well as spells.
  const coverage = { camps: ['spell', 'physical'], reaches: ['contact', 'near', 'far'], targeting: ['single'], effects: ['damage', 'status'] };
  const payload = { hp: 10, poise: 0, ward: 2 };
  const traited = counterReturn({ mode: 'spell', incoming: projectile, coverage, payload, traitValues: { impact: 2, flux: 1 } });
  assert.equal(traited.hp, 0, 'a Spell Counter drains Ward only against a projectile');
  assert.equal(traited.poise, 0);
  assert.equal(traited.ward, 4, 'Ward still doubles: 2 authored Ward becomes 4');
});

test('reaction rules version 1 leaves Counter returns untouched by trait values', () => {
  const plain = counterReturn({ version: 1 });
  const traited = counterReturn({ version: 1, traitValues: { counterstrike: true, impact: 2, flux: 1 } });
  assert.deepEqual([traited.hp, traited.poise, traited.ward], [plain.hp, plain.poise, plain.ward]);
});

// The Defend trait guard: armed when a Defend with Impact/Flux is prepared, spent by the first enemy hit
// that Block, Barrier or Ward reduced, cleared at the owner's turn start.
function guardFight() {
  const f = fixture();
  const { combat } = f;
  const enemy = f.enemies[0];
  const defend = { cardId: 'testDefend', instanceId: 'test-defend', type: 'skill',
    combatProfile: { camp: 'physical', maneuver: 'defend', reach: 'contact', targeting: 'single' } };
  const hit = (blocked, hpLoss = 0) => {
    const receipt = beginTacticalAction(combat, enemy, combat.player, { combatProfile: PHYSICAL }, [{ amount: 8 }]);
    recordTacticalContact(receipt, { blocked, hpLoss });
    const before = { poise: enemy.poiseMeter.value, ward: enemy.persistentWard.value };
    completeTacticalAction(combat, enemy, combat.player, { combatProfile: PHYSICAL }, receipt);
    drain(combat);
    return { poise: enemy.poiseMeter.value - before.poise, ward: before.ward - enemy.persistentWard.value };
  };
  return { ...f, enemy, defend, hit };
}

test('a Defend trait guard answers the first reduced enemy hit once, then is gone', () => {
  const f = guardFight();
  setCombatStance(f.combat, f.combat.player, { ...f.defend, traitValues: { impact: 2, flux: 1 } });
  assert.deepEqual(f.combat.player.combatTraitGuard, { poise: 2, ward: 1 });
  setCombatStance(f.combat, f.combat.player, { ...f.defend, traitValues: { impact: 1, flux: 3 } });
  assert.deepEqual(f.combat.player.combatTraitGuard, { poise: 2, ward: 3 }, 'max-merged, not stacked');
  assert.deepEqual(f.hit(0, 5), { poise: 0, ward: 0 }, 'an unreduced hit leaves the guard armed');
  assert.ok(f.combat.player.combatTraitGuard);
  assert.deepEqual(f.hit(3, 5), { poise: 2, ward: 3 });
  assert.equal(f.combat.player.combatTraitGuard, undefined);
  assert.deepEqual(f.hit(3, 5), { poise: 0, ward: 0 }, 'the guard fires once');
});

test('the owner turn start clears an unspent Defend trait guard', () => {
  const f = guardFight();
  setCombatStance(f.combat, f.combat.player, { ...f.defend, traitValues: { impact: 2 } });
  startTacticalTurn(f.combat, f.combat.player);
  assert.equal(f.combat.player.combatTraitGuard, undefined);
});

test('a Defend trait guard survives a combat snapshot round trip', () => {
  const f = guardFight();
  setCombatStance(f.combat, f.combat.player, { ...f.defend, traitValues: { impact: 2, flux: 1 } });
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(f.combat)));
  const restored = restoreCombatSnapshot({ registries, rng: createRng(901), snapshot: saved });
  assert.deepEqual(restored.player.combatTraitGuard, { poise: 2, ward: 1 });
  for (const bad of [{ poise: 1e9 + 0.5, ward: 1 }, { poise: -1, ward: 0 }, { poise: 2 }, 'x']) {
    const corrupt = structuredClone(saved);
    corrupt.player.combatTraitGuard = bad;
    assert.throws(() => restoreCombatSnapshot({ registries, rng: createRng(901), snapshot: corrupt }), /combatTraitGuard/, JSON.stringify(bad));
  }
});

test('a trait guard caps Poise and Ward at 999 so the meter fill loop always terminates', async () => {
  const { combatTraitGuardProblems } = await import('../src/model/combatTacticsRules.js');
  for (const value of [0, 1, 999]) {
    assert.deepEqual(combatTraitGuardProblems({ poise: value, ward: value }, 'g'), [], `accepts ${value}`);
  }
  for (const value of [1000, Number.MAX_SAFE_INTEGER]) {
    assert.ok(combatTraitGuardProblems({ poise: value, ward: 0 }, 'g').some(problem => /poise/.test(problem)), `poise ${value}`);
    assert.ok(combatTraitGuardProblems({ poise: 0, ward: value }, 'g').some(problem => /ward/.test(problem)), `ward ${value}`);
  }
});

test('a saved Counter carrier refuses malformed trait values', async () => {
  const { combatCounterProblems } = await import('../src/model/combatTacticsRules.js');
  const counter = traits => ({ version: 2, charges: 1, serial: 1, mode: 'melee', expiresOnOwnerCycle: 1,
    coverage: { camps: ['physical'], reaches: ['contact'], targeting: ['single'], effects: ['damage'] },
    payload: { hp: 4, poise: 2, ward: 0 }, carrier: { combatProfile: { maneuver: 'counter' }, ...(traits ? { traitValues: traits } : {}) } });
  const traitProblems = traits => combatCounterProblems(counter(traits), 'c', 2).filter(problem => /traitValues/.test(problem));
  assert.deepEqual(traitProblems(undefined), []);
  assert.deepEqual(traitProblems({ counterstrike: true, impact: 2, flux: 1 }), []);
  for (const bad of [{ impact: 1e9 }, { flux: -1 }, { impact: 1.5 }, { counterstrike: 'yes' }, { bogus: 1 }, 'x']) {
    assert.ok(traitProblems(bad).length > 0, JSON.stringify(bad));
  }
});
