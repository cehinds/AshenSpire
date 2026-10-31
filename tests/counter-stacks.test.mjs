// Counter stacks (owner 2026-10-31, SPEC §17): the Block a Counter card stands behind becomes stacks on the combat entity;
// they persist until the fight ends, cap at mechanics.counter.stackCap, and a covered hit returns the card's base damage
// plus floor(stacks x 10% x incoming). In Counter stance a card-less auto-Counter (1 SP, base 0) is offered, and a Counter
// reaction costs one less SP there.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { profileCardCosts } from '../src/engine/gameProfileCombat.js';
import { counterReturn } from '../src/engine/counterRule.js';
import { counterStackReturn } from '../src/engine/guardStacks.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';
import { mechanics } from '../src/framework/data/mechanics.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function live() {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  combat.player.basePrecisionBonus = 1000;
  // A plain 8-damage Attack that always lands, with no rating or status noise.
  Object.assign(enemy, { hp: 500, maxHp: 500, statuses: {}, ratings: { poise: 20 }, ratingSources: [], attributes: { dexterity: 0 }, basePrecisionBonus: 1000 });
  return { combat, enemy };
}
const withCounter = () => { const x = live(); x.combat.piles.hand.push({ instanceId: 'cx1', cardId: 'core.counter' }); return x; };
const endTurn = combat => { dispatch(combat, { type: 'setReactions', enabled: false }); const start = combat.eventLog.length; dispatch(combat, { type: 'endTurn' }); return combat.eventLog.slice(start); };
const returnEvent = events => events.find(e => e.type === 'combatCounterTriggered');

test('playing a Counter adds the player\'s current Block (after the card\'s own Block) as Counter stacks', () => {
  const { combat } = withCounter();
  assert.equal(combat.player.counterStacks ?? 0, 0);
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cx1' });
  assert.ok(combat.player.block >= 5, 'the card\'s own Block landed first');
  assert.equal(combat.player.counterStacks, combat.player.block, 'stacks equal the Block held after the play');
});

test('stacks are capped at mechanics.counter.stackCap', () => {
  const { combat } = withCounter();
  combat.player.counterStacks = mechanics.counter.stackCap - 1;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cx1' });
  assert.equal(combat.player.counterStacks, mechanics.counter.stackCap);
});

test('stacks persist across the owner turn start and a stance change (only the single-use charge clears)', () => {
  const { combat } = withCounter();
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cx1' });
  const stacks = combat.player.counterStacks;
  assert.ok(stacks > 0);
  endTurn(combat);
  assert.equal(combat.phase, 'player', 'a new owner turn began');
  assert.equal(combat.player.counterStacks, stacks, 'owner turn start leaves the stacks alone');
  assert.equal(combat.player.combatCounter, undefined, 'the single-use charge is gone');
  combat.player.combatStance = { maneuver: 'attack', camp: 'physical', range: 'melee' };
  assert.equal(combat.player.counterStacks, stacks, 'a stance change leaves them alone');
});

test('the return is the card\'s base damage + floor(stacks x 0.1 x incoming) (+ the advantage share): 4 + floor(7 x 0.1 x 8) + 2 = 11', () => {
  const { combat } = withCounter();
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cx1' });
  combat.player.counterStacks = 7;
  Object.assign(combat.player, { block: 5, persistentPoise: { value: 20, max: 20 } });
  const triggered = returnEvent(endTurn(combat));
  assert.equal(triggered.amount, 4 + Math.floor(7 * 0.1 * 8) + 2);
  assert.equal(triggered.amount, 11);
  assert.equal(triggered.counterBase, 4); assert.equal(triggered.counterStacks, 7); assert.equal(triggered.counterIncoming, 8);
});

test('counterReturn units: base once, stacks floor per hit, no return from a zero hit', () => {
  const { combat } = live();
  assert.equal(counterStackReturn(3, 10), 3);
  assert.equal(counterStackReturn(20, 9), 18);
  assert.equal(counterStackReturn(0, 50), 0);
  assert.deepEqual(counterReturn(combat, 10, false, { base: 4, stacks: 5 }), { hp: 9, poise: 1, block: 0 });
  assert.deepEqual(counterReturn(combat, 0, false, { base: 4, stacks: 5 }), { hp: 0, poise: 0, block: 0 });
});

function inCounterStance({ sp = 3, stance = 'counter', stacks = 10 } = {}) {
  const { combat, enemy } = live();
  combat.piles.hand.length = 0; // no Counter card in hand: only the card-less option can answer
  if (stance) combat.player.combatStance = { maneuver: stance, camp: 'physical', range: 'melee' };
  combat.player.counterStacks = stacks;
  combat.player.energy = sp;
  dispatch(combat, { type: 'endTurn' });
  return { combat, enemy };
}

test('auto-Counter: offered in Counter stance for 1 SP; answering it returns stacks x 10% of the hit (base 0), costs the SP', () => {
  const { combat } = inCounterStance({ sp: 3, stacks: 10 });
  const option = combat.pendingReaction?.options.find(row => row.autoCounter);
  assert.ok(option, 'the card-less option is offered');
  assert.equal(option.cardId, null);
  assert.equal(option.staminaCost, mechanics.counter.autoCounterStamina);
  assert.equal(option.staminaCost, 1);
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: option.id });
  const events = combat.eventLog.slice(start);
  assert.equal(events.find(e => e.type === 'staminaSpent')?.amount, 1, 'paid 1 SP');
  const triggered = returnEvent(events);
  assert.equal(triggered.counterBase, 0, 'base damage 0');
  assert.equal(triggered.amount, Math.floor(10 * 0.1 * 8) + 2, 'stacks share 8 + advantage 2, no card damage');
});

test('auto-Counter: not offered outside Counter stance, and not with no SP', () => {
  assert.equal(inCounterStance({ stance: 'defend' }).combat.pendingReaction?.options?.some(row => row.autoCounter) ?? false, false);
  assert.equal(inCounterStance({ stance: null }).combat.pendingReaction?.options?.some(row => row.autoCounter) ?? false, false);
  assert.equal(inCounterStance({ sp: 0 }).combat.pendingReaction?.options?.some(row => row.autoCounter) ?? false, false);
});

test('a Counter reaction in Counter stance costs max(sp - 1, 0), Adept or not; other cards keep their price', () => {
  const { combat } = live();
  const reaction = sp => ({ id: 'x.counter', staminaCost: sp, manaCost: 0, cardTags: ['trait:reaction', 'maneuver:counter'], combatProfile: { maneuver: 'counter', camp: 'physical', range: 'melee' } });
  const cost = def => profileCardCosts(combat, def).stamina;
  combat.player.combatStance = { maneuver: 'counter', camp: 'physical', range: 'melee' };
  combat.phase = 'enemy';
  for (const adept of [true, false]) {
    combat.player.classUnequipped = !adept;
    assert.deepEqual([0, 1, 2, 3].map(sp => cost(reaction(sp))), [0, 0, 1, 2], `adept=${adept}`);
  }
  combat.player.classUnequipped = true;
  const plain = { ...reaction(3), cardTags: ['maneuver:counter'] };
  assert.equal(cost(plain), 3, 'a Counter without the Reaction trait keeps the Adept gate');
  combat.phase = 'player';
  assert.equal(cost(reaction(3)), 3, 'on the owner turn it keeps authored SP');
});

test('snapshots round-trip counterStacks, load without it, and refuse a count over the cap', () => {
  const { combat, enemy } = live();
  Object.assign(enemy, { ratings: { ar: 0, dr: 0, pr: 0, ward: 0, poise: 20 } });
  combat.piles.hand.push({ instanceId: 'cx1', cardId: 'core.counter', upgraded: false });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cx1' });
  const snapshot = serializeCombatSnapshot(combat);
  assert.deepEqual(combatSnapshotProblems(snapshot), []);
  const loaded = restoreCombatSnapshot({ registries: reg, rng: createRng(511, combat.rng.getCounters()), snapshot });
  assert.equal(loaded.player.counterStacks, combat.player.counterStacks);
  const old = structuredClone(snapshot);
  delete old.player.counterStacks;
  assert.deepEqual(combatSnapshotProblems(old), [], 'absent means 0: old saves load');
  old.player.counterStacks = mechanics.counter.stackCap + 1;
  assert.ok(combatSnapshotProblems(old).some(problem => problem.includes('counterStacks')));
  old.player.counterStacks = -1;
  assert.ok(combatSnapshotProblems(old).some(problem => problem.includes('counterStacks')));
});

test('a paused fight offering the card-less auto-Counter saves and restores with the option intact', () => {
  const { combat, enemy } = live();
  Object.assign(enemy, { ratings: { ar: 0, dr: 0, pr: 0, ward: 0, poise: 20 } });
  combat.piles.hand.length = 0;
  combat.player.combatStance = { maneuver: 'counter', camp: 'physical', range: 'melee' };
  combat.player.energy = 2;
  dispatch(combat, { type: 'endTurn' });
  assert.ok(combat.pendingReaction?.options.some(row => row.autoCounter), 'the offer is open');
  const snapshot = serializeCombatSnapshot(combat);
  assert.deepEqual(combatSnapshotProblems(snapshot), []);
  const loaded = restoreCombatSnapshot({ registries: reg, rng: createRng(511, combat.rng.getCounters()), snapshot });
  const option = loaded.pendingReaction.options.find(row => row.autoCounter);
  assert.deepEqual([option.id, option.cardId, option.staminaCost], ['autoCounter', null, 1]);
});
