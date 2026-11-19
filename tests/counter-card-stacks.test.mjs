// Wave 2 batch 5 (owner, 2026-11-15): Counter acts like Evade. A Counter card grants its own 1..3 stacks (never the Block held); each covered hit that
// lands returns the card's base damage + floor(incoming x 0.1 x stacks held before the hit) and spends one stack; one stack fades at the owner's turn
// start; stacks held have no cap; the Counter stance returns nothing of its own. A fight saved before the ruling keeps the Block-as-stacks rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { withoutCounterStacks } from './legacyStanceRules.mjs';
import { validateFixCoreRules, CounterStacksForCard } from '../src/model/fixCoreMechanics.js';
import { fixCoreMechanics as shipped } from '../src/content/generated/fixCoreMechanics.js';
import { combatLogEntries } from '../src/model/combatLog.js';
import { CounterHitAnswers, counterReturnForReceipt } from '../src/engine/counterRule.js';
import { primeEnemyCounter } from '../src/engine/combatCardTactics.js';

// Pins this file's SPEC worked examples (a Counter, Poise or Smash rule, not damage scale): the Core 0.5 base-damage scale is off here.
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { effects: { baseDamageMultiplier: 1, physicalDamageMultiplier: 1, playerDamageMultiplier: 1, enemyDamageMultiplier: 1, blockGainMultiplier: 1 } } });
const bundle = (hits, damage = 8) => ({ ...contentBundle, enemies: contentBundle.enemies.map(e => e.id === 'wanderingSoldier' ? { ...e, moves: { ...e.moves, slash: { intent: 'attack', damage, hits, weight: 45 } } } : e) });
const regFor = (hits, damage = 8) => bindGameProfileRegistries(createRegistries(applyGameProfileToContent(bundle(hits, damage), profile)), profile);
const reg = regFor(1), reg3 = regFor(3);
function live({ registries = reg, hits = 1, legacy = false, damage = 8 } = {}) {
  const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  if (legacy) withoutCounterStacks(combat);
  const enemy = combat.enemies[0];
  delete combat.reactionRules.contactPolicy;
  Object.assign(combat.player, { basePrecisionBonus: 1000, hp: 9999, maxHp: 9999, energy: 99 });
  Object.assign(enemy, { hp: 5000, maxHp: 5000, statuses: {}, ratings: { poise: 20 }, ratingSources: [], attributes: { dexterity: 0 }, basePrecisionBonus: 1000 });
  enemy.combatStance = { maneuver: 'attack', camp: 'physical', range: 'melee' };
  Object.assign(enemy, { maxStamina: 3, stamina: 3, plannedMoves: [] });
  enemy.intent = { ...enemy.intent, kind: 'attack', moveId: 'slash', damage, hits, combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing', range: 'melee', targeting: 'single', traits: [], stanceTrigger: false } };
  dispatch(combat, { type: 'setReactions', enabled: false });
  return { combat, enemy };
}
const give = (combat, id, cardId = 'core.counter', extra = {}) => combat.piles.hand.push({ instanceId: id, cardId, ...extra });
const play = (combat, id) => dispatch(combat, { type: 'playCard', cardInstanceId: id });
const endTurn = combat => { const from = combat.eventLog.length; dispatch(combat, { type: 'endTurn' }); return combat.eventLog.slice(from); };

test('a Counter card grants its own stacks (core.counter 1, upgraded 2), never the Block held, and stacks held have no cap', () => {
  const { combat } = live();
  const seen = [];
  for (let i = 0; i < 4; i++) { give(combat, `c${i}`); play(combat, `c${i}`); seen.push(combat.player.counterStacks); }
  assert.deepEqual(seen, [1, 2, 3, 4], 'one stack a play although the Block held climbs 5, 12, 19, ...');
  assert.ok(combat.player.block > 20, 'the Block is not what is counted');
  combat.player.counterStacks = 500;
  give(combat, 'big'); play(combat, 'big');
  assert.equal(combat.player.counterStacks, 501, 'no cap on stacks held');
  const up = live().combat; give(up, 'u', 'core.counter', { upgraded: true }); play(up, 'u');
  assert.equal(up.player.counterStacks, 2, 'the authored upgrade grants 2');
});

test('the reported 100+ case: four Counter plays then one 10-damage hit return 4 + floor(10 x 0.1 x 4) = 8, not 134', () => {
  const { combat } = live();
  for (let i = 0; i < 4; i++) { give(combat, `c${i}`); play(combat, `c${i}`); }
  const events = endTurn(combat);
  const hit = events.find(e => e.type === 'combatCounterTriggered');
  assert.equal(hit.counterStacks, 4); assert.equal(hit.counterIncoming, 10);
  assert.equal(hit.amount, hit.counterBase + Math.floor(hit.counterIncoming * 0.1 * 4));
  assert.equal(hit.amount, 8, 'was 4 + 128 + 2 = 134');
  assert.equal(combat.player.counterStacks, 3 - 1 + 0, 'one spent by the hit, one faded at the next turn start');
});

test('a multi-hit attack against 3 stacks returns 3 times with falling stack counts, then the stacks are gone', () => {
  const { combat } = live({ registries: reg3, hits: 3 });
  combat.player.counterStacks = 2; give(combat, 'c'); play(combat, 'c');
  assert.equal(combat.player.counterStacks, 3);
  const events = endTurn(combat);
  const trig = events.find(e => e.type === 'combatCounterTriggered');
  assert.deepEqual(trig.counterHits.map(row => row.stacksBefore), [3, 2, 1]);
  trig.counterHits.forEach(row => assert.equal(row.amount, 4 + Math.floor(row.incoming * 0.1 * row.stacksBefore), 'each hit: base + 10% of that hit per stack held before it'));
  assert.equal(trig.amount, trig.counterHits.reduce((s, row) => s + row.amount, 0));
  assert.equal(events.filter(e => e.type === 'counterStacksChanged' && e.consumed).reduce((s, e) => s - e.amount, 0), 3);
  assert.equal(combat.player.counterStacks ?? 0, 0);
  assert.match(combatLogEntries([trig], { registries: reg3, enemies: combat.enemies })[0].text, /\(3 hits: \d+ \+ \d+ \+ \d+\)/);
});

test('with fewer stacks than hits, the later hits land unanswered', () => {
  const { combat } = live({ registries: reg3, hits: 3 });
  combat.player.counterStacks = 1; give(combat, 'c'); play(combat, 'c');
  const trig = endTurn(combat).find(e => e.type === 'combatCounterTriggered');
  assert.equal(trig.counterHits.length, 2);
});

test('one stack fades at the owner turn start (5 -> 4 -> 3 -> 2 -> 1 -> 0)', () => {
  const { combat } = live();
  combat.player.counterStacks = 5;
  const seen = [];
  for (let i = 0; i < 5; i++) { endTurn(combat); seen.push(combat.player.counterStacks ?? 0); }
  assert.deepEqual(seen, [4, 3, 2, 1, 0]);
});

test('the Counter stance returns nothing of its own: a hit that costs HP in Counter stance deals no stance return', () => {
  const { combat, enemy } = live();
  combat.player.combatStance = { maneuver: 'counter', camp: 'physical', range: 'melee' };
  combat.player.block = 0;
  const hp = enemy.hp;
  const events = endTurn(combat);
  assert.ok(events.some(e => e.type === 'damageDealt' && e.targetId === 'player' && e.hpLoss > 0), 'the hit cost HP');
  assert.ok(!events.some(e => e.type === 'stanceCounterReturn'));
  assert.equal(enemy.hp, hp);
});

test('shown = dealt: the card face and the per-root forecast quote the return the exchange deals', () => {
  const { combat } = live({ registries: reg3, hits: 3 });
  combat.player.counterStacks = 4; give(combat, 'c');
  const forecast = previewCard(combat, 'c').counterReturn;
  play(combat, 'c');
  const trig = endTurn(combat).find(e => e.type === 'combatCounterTriggered');
  assert.ok(forecast.hp > 0);
  assert.equal(forecast.hp, trig.amount);
});

test('a fight saved before the ruling keeps the Block-as-stacks rule: stacks = the Block held, a single return, 2 fade a turn', () => {
  const { combat } = live({ legacy: true });
  give(combat, 'c'); play(combat, 'c');
  assert.equal(combat.player.counterStacks, combat.player.block, 'old rule: stacks are the Block held');
  assert.ok(combat.player.counterStacks >= 5);
  const stacks = combat.player.counterStacks;
  const trig = endTurn(combat).find(e => e.type === 'combatCounterTriggered');
  assert.equal(trig.counterStacks, stacks);
  assert.equal(trig.counterHits, undefined, 'one return, no per-hit list');
  assert.equal(combat.player.counterStacks, stacks - 2, 'the old fade of 2, and the hit spent none');
});

test('the data: every shipped grant is within 1..3, core.counter grants 1 (upgraded 2), the validator holds the range', () => {
  const rules = shipped.counter;
  assert.equal(rules.stackSource, 'card'); assert.equal(rules.returnPerStack, 0.1); assert.equal(rules.consumePerHit, 1); assert.equal(rules.decayPerTurn, 1);
  assert.equal(rules.advantageShare, 0);
  assert.equal(CounterStacksForCard(rules, 'core.counter'), 1);
  assert.equal(CounterStacksForCard(rules, 'core.counter', true), 2);
  const registries = reg;
  const counters = registries.cards.all().filter(card => !card.id.includes('.') || card.id === 'core.counter')
    .filter(card => (card.tags || []).includes('maneuver:counter') || card.combatProfile?.maneuver === 'counter');
  assert.ok(counters.length >= 17, `found the shipped Counter cards (${counters.length})`);
  for (const card of counters) for (const upgraded of [false, true]) {
    const grant = CounterStacksForCard(rules, card.id, upgraded);
    assert.ok(grant >= 1 && grant <= 3, `${card.id}${upgraded ? '+' : ''} grants ${grant}`);
  }
  for (const [id, value] of Object.entries(rules.stacksByCard)) { assert.ok(registries.cards.has(id), `${id} is a shipped card`); assert.ok(value >= 1 && value <= 3, id); }
  assert.doesNotThrow(() => validateFixCoreRules(shipped));
  assert.throws(() => validateFixCoreRules({ ...shipped, counter: { ...rules, stacksByCard: { 'core.counter': 4 } } }), /stacksByCard/);
  assert.throws(() => validateFixCoreRules({ ...shipped, counter: { ...rules, stacksPerCard: 0 } }), /counter stacks/);
});

test('auto-Counter in Counter stance (no card, base 0) returns floor(incoming x 0.1 x stacks) and spends one stack', () => {
  const { combat } = live();
  dispatch(combat, { type: 'setReactions', enabled: true });
  combat.piles.hand.length = 0;
  combat.player.combatStance = { maneuver: 'counter', camp: 'physical', range: 'melee' };
  combat.player.counterStacks = 5;
  dispatch(combat, { type: 'endTurn' });
  const option = combat.pendingReaction?.options.find(row => row.autoCounter);
  assert.ok(option, 'the card-less option is offered');
  const from = combat.eventLog.length;
  dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: option.id });
  const trig = combat.eventLog.slice(from).find(e => e.type === 'combatCounterTriggered');
  assert.equal(trig.counterBase, 0);
  assert.equal(trig.amount, Math.floor(trig.counterIncoming * 0.1 * 5));
  assert.equal(combat.player.counterStacks, 4 - 1 + 0, 'one spent by the hit, one faded at the next turn start');
});

// Review fix (2026-11-15): the card-stack rule is the player's; an armed ENEMY Counter keeps the previous path, so it returns what it returned before.
function enemyCounterHit(legacy) {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['gildedKnight'] });
  if (legacy) withoutCounterStacks(combat);
  const enemy = combat.enemies[0];
  Object.assign(combat.player, { basePrecisionBonus: 1000, hp: 9999, maxHp: 9999, energy: 99, block: 0, evasion: 0, wardBlock: 0 });
  Object.assign(enemy, { hp: 5000, maxHp: 5000, statuses: {}, basePrecisionBonus: 1000 });
  dispatch(combat, { type: 'setReactions', enabled: false });
  const move = reg.enemies.get('gildedKnight').moves.parry;
  primeEnemyCounter(combat, enemy, move, 'parry');
  for (let n = 0; combat.queue.length && n < 100; n++) combat.queue.shift();
  give(combat, 'k', 'core.strike');
  const from = combat.eventLog.length, hp = combat.player.hp;
  play(combat, 'k');
  const events = combat.eventLog.slice(from);
  return { combat, trig: events.find(e => e.type === 'combatCounterTriggered'), taken: hp - combat.player.hp };
}

test('an armed enemy Counter returns under the shipped card-stack rules exactly as on the previous path (not 0), and the player takes it', () => {
  const now = enemyCounterHit(false), before = enemyCounterHit(true);
  assert.ok(before.trig.amount > 0, 'the legacy path returns');
  assert.equal(now.trig.amount, before.trig.amount);
  assert.equal(now.trig.counterHits, undefined, 'an enemy keeps one lump return, no per-hit stack list');
  assert.equal(now.taken, before.taken);
  assert.ok(now.taken > 0, 'the return damages the player');
});

test('forecast and live share one predicate: a hit answers only with stacks held AND incoming damage, and a skipped hit spends nothing', () => {
  assert.equal(CounterHitAnswers(2, 0), false, 'a 0-incoming hit keeps its stack');
  assert.equal(CounterHitAnswers(0, 5), false, 'no stacks, no return');
  assert.equal(CounterHitAnswers(1, 1), true);
  // A multi-hit receipt whose first hit has 0 incoming: the live return skips it and spends no stack; the second hit still sees both stacks.
  const { combat } = live();
  const receipt = { covered: [true, true, true], incomings: [0, 9, 9], profiles: [] };
  const out = counterReturnForReceipt(combat, receipt, { stacks: 2, base: 4, owner: combat.player });
  assert.deepEqual(out.hits.map(row => row.stacksBefore), [2, 1], 'the 0-incoming hit spent no stack');
  assert.equal(out.consumed, 2);
});
