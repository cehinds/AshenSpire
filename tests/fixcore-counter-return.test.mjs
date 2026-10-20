// Core 2 Counter (owner ruling 2026-10-19, SPEC §17): return = floor(0.5 x incoming), Poise = floor(0.2 x return);
// with advantage +floor(0.25 x incoming) return, Poise = floor(0.5 x return), +floor(0.25 x incoming) Block.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { counterReturn, counterBeats } from '../src/engine/counterRule.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const houndBundle = { ...contentBundle, enemies: contentBundle.enemies.map(row => row.id === 'blightHound' ? { ...row, firstMove: 'lunge' } : row) };
const mantisBundle = { ...contentBundle, enemies: contentBundle.enemies.map(row => row.id === 'cinderMantis' ? { ...row, firstMove: 'scythePair' } : row) };
const wyrmBundle = { ...contentBundle, enemies: contentBundle.enemies.map(row => row.id === 'wyrmLord' ? { ...row, firstMove: 'tailSweep' } : row) };
const regs = { wyrmLord: bindGameProfileRegistries(createRegistries(applyGameProfileToContent(wyrmBundle, profile)), profile), cinderMantis: bindGameProfileRegistries(createRegistries(applyGameProfileToContent(mantisBundle, profile)), profile), wanderingSoldier: bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile),
  blightHound: bindGameProfileRegistries(createRegistries(applyGameProfileToContent(houndBundle, profile)), profile) };
const reg = regs.wanderingSoldier;
function live(enemyId = 'wanderingSoldier') {
  const run = createRunState({ registries: regs[enemyId], classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: regs[enemyId], run, rng: createRng(511), enemyIds: [enemyId] });
  const enemy = combat.enemies[0];
  // The Counter's return is an attack with its own opposed roll, so the player needs the same flat Precision (below).
  combat.player.basePrecisionBonus = 1000;
  // A plain 8-damage Attack: no rating, status or Poise noise on either side of the exchange.
  Object.assign(enemy, { hp: 500, maxHp: 500, statuses: {}, ratings: { poise: 20 }, ratingSources: [], attributes: { dexterity: 0 },
    // FixCore hit rolls are opposed d20s (owner, 2026-10-19): a large flat Precision leaves only a natural 1 able to miss, so the exchange's hit lands.
    basePrecisionBonus: 1000 });
  combat.piles.hand.push({ instanceId: 'cx1', cardId: 'core.counter' });
  return { combat, enemy };
}
function exchange() {
  const { combat, enemy } = live();
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cx1' });
  Object.assign(combat.player, { block: 5, persistentPoise: { value: 20, max: 20 } });
  assert.equal(enemy.intent.damage, 8); assert.equal(enemy.intent.combatProfile.maneuver, 'attack');
  dispatch(combat, { type: 'setReactions', enabled: false });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  return { combat, enemy, events: combat.eventLog.slice(start) };
}

test('worked example: Attack 8 into Counter (5 Block, 4 damage) gives Block 7, return 6, Poise 3', () => {
  const { combat } = live();
  assert.deepEqual(counterReturn(combat, 8, counterBeats(combat, 'attack')), { hp: 6, poise: 3, block: 2 });
  assert.deepEqual(counterReturn(combat, 8, counterBeats(combat, 'smash')), { hp: 6, poise: 3, block: 2 });
});

test('without advantage (Sweep) the same 8 damage returns 4, Poise 0, adds no Block', () => {
  const { combat } = live();
  assert.equal(counterBeats(combat, 'sweep'), false);
  assert.deepEqual(counterReturn(combat, 8, counterBeats(combat, 'sweep')), { hp: 4, poise: 0, block: 0 });
  assert.deepEqual(counterReturn(combat, 9, false), { hp: 4, poise: 0, block: 0 });
  assert.deepEqual(counterReturn(combat, 0, true), { hp: 0, poise: 0, block: 0 });
});

test('live: the Counter adds 2 Block before the hit, then returns 6 damage and 3 Poise damage', () => {
  const { enemy, events } = exchange();
  const gained = events.find(e => e.type === 'blockGained' && e.source === 'counter');
  assert.equal(gained.amount, 2); assert.equal(gained.total, 7);
  const taken = events.find(e => e.type === 'damageDealt' && e.targetId === 'player');
  assert.equal(taken.amount, 7); assert.equal(taken.blocked, 7);
  const returned = events.filter(e => e.type === 'damageDealt' && e.targetId === enemy.id);
  // The enemy's Poise absorbs a quarter of the 6 (SPEC §17 Poise); the return itself skips the chain's own stance multiplier.
  assert.equal(returned.reduce((sum, e) => sum + e.hpLoss + e.poiseAbsorbed, 0), 6);
  const poise = events.find(e => e.type === 'persistentPoiseChanged' && e.targetId === enemy.id && e.source === 'poiseDamage' && e.cardId === 'core.counter');
  assert.equal(poise.spent, 3);
});

import { previewCard } from '../src/engine/combat.js';
test('the Counter card preview names the same return the live exchange deals (no attack-rating mismatch)', () => {
  const { combat, enemy } = live();
  const damage = previewCard(combat, 'cx1', enemy.id).values.find(row => row.op === 'damage');
  // Preview against the revealed 8-damage Attack: 6 return damage, less the enemy's own Poise (25% of 6, floored).
  const receipt = damage.damageReceipt.hits[0];
  assert.equal(receipt.incoming, 6, 'the card previews floor(0.5 x 8) + floor(0.25 x 8)');
  const protectedLoss = damage.damageReceipt.hits.reduce((sum, hit) => sum + (hit.hpLoss ?? hit.hp ?? 0), 0);
  assert.equal(damage.totalDamage, 6, 'the face token reads the return');
  const { events } = exchange();
  const live6 = events.filter(e => e.type === 'damageDealt' && e.cardId === 'core.counter');
  assert.equal(live6.reduce((sum, e) => sum + e.hpLoss, 0), protectedLoss);
});

test('preview equals live against an enemy whose attack carries rating bonuses', () => {
  const { combat, enemy } = live();
  // Restore a real attacker: 8 base plus its rating bonus, so the incoming damage is not the printed 8.
  Object.assign(enemy, { ratings: { ar: 6, poise: 20 } });
  const damage = previewCard(combat, 'cx1', enemy.id).values.find(row => row.op === 'damage');
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cx1' });
  combat.player.block = 999;
  dispatch(combat, { type: 'setReactions', enabled: false });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const events = combat.eventLog.slice(start);
  const returned = events.filter(e => e.type === 'damageDealt' && e.cardId === 'core.counter');
  assert.ok(returned.length, 'the Counter fired');
  assert.equal(returned.reduce((sum, e) => sum + e.hpLoss, 0), damage.damageReceipt.hits.reduce((sum, hit) => sum + (hit.hpLoss ?? hit.hp ?? 0), 0));
});

import { profileCardCosts } from '../src/engine/gameProfileCombat.js';
import { cardPlayCosts } from '../src/engine/combat.js';
test('a reaction card played from hand costs max(SP - 1, 0); other cards are untouched', () => {
  const { combat } = live();
  const reaction = base => ({ id: 'x.reaction', staminaCost: base, manaCost: 0, tags: ['trait:reaction', 'maneuver:attack'] });
  const plain = base => ({ id: 'x.plain', staminaCost: base, manaCost: 0, tags: ['maneuver:attack'] });
  delete combat.player.combatStance;
  assert.deepEqual([0, 1, 2, 3].map(sp => profileCardCosts(combat, reaction(sp)).stamina), [0, 0, 1, 2]);
  assert.deepEqual([0, 1, 2, 3].map(sp => profileCardCosts(combat, plain(sp)).stamina), [0, 1, 2, 3]);
});

test('the real Counter card is free to play from hand; the playability check and card face read the same price', () => {
  const { combat } = live();
  assert.equal(cardPlayCosts(combat, 'cx1').stamina, 0);
  combat.player.stamina = 0;
  const before = combat.player.stamina;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cx1' });
  assert.equal(combat.player.stamina, before);
  assert.ok(combat.player.combatCounter, 'the zero-cost Counter still arms');
});

test('the preview marks a reduced SP price so the card face can show it down; an untouched card has no mark', () => {
  const { combat } = live();
  delete combat.player.combatStance;
  assert.equal(previewCard(combat, 'cx1').costShift, -1);
  assert.equal(previewCard(combat, 'cx1').cost, 0);
  const strike = combat.piles.hand.find(row => row.cardId === 'core.strike');
  assert.equal(previewCard(combat, strike.instanceId).costShift, undefined);
});

test('Core: the Counter returns even when damage gets through (no Poise: 8 into 7 Block leaves 1, return still 6)', () => {
  const { combat, enemy } = live();
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cx1' });
  Object.assign(combat.player, { block: 5, persistentPoise: { value: 0, max: 0 } });
  dispatch(combat, { type: 'setReactions', enabled: false });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const events = combat.eventLog.slice(start);
  const taken = events.find(e => e.type === 'damageDealt' && e.targetId === 'player');
  assert.equal(taken.blocked, 7); assert.equal(taken.hpLoss, 1);
  const returned = events.filter(e => e.type === 'damageDealt' && e.cardId === 'core.counter');
  assert.equal(returned.reduce((sum, e) => sum + e.hpLoss + e.poiseAbsorbed, 0), 6);
});

import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
test('a Core Counter return skips matching-stance and defensive-stance stages (Sweep target keeps 4)', () => {
  const { combat, enemy } = live();
  Object.assign(combat.player, { ratings: {}, ratingSources: [], statuses: {}, combatStance: { maneuver: 'counter', camp: 'physical', range: 'melee' } });
  enemy.combatStance = { maneuver: 'sweep', camp: 'physical', range: 'melee' };
  const carrier = { skipRatingBonus: true, counterReturnAttack: true, combatReaction: true,
    combatProfile: { camp: 'physical', maneuver: 'counter', damageType: 'slashing', range: 'melee', targeting: 'single' } };
  const incoming = base => profileDamageReceipt(combat, combat.player, enemy, base, carrier).damageReceipt.hits[0].incoming;
  assert.equal(incoming(4), 4);
  assert.equal(incoming(6), 6);
});

test('Counter played while already in Counter stance still returns 6 in the worked example', () => {
  const { combat, enemy } = live();
  combat.player.combatStance = { maneuver: 'counter', camp: 'physical', range: 'melee' };
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cx1' });
  Object.assign(combat.player, { block: 5, persistentPoise: { value: 20, max: 20 } });
  dispatch(combat, { type: 'setReactions', enabled: false });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const returned = combat.eventLog.slice(start).filter(e => e.type === 'damageDealt' && e.cardId === 'core.counter');
  assert.equal(returned.reduce((sum, e) => sum + e.hpLoss + e.poiseAbsorbed, 0), 6);
});

test('multi-hit preview sums the hits one by one (sequential receipts) and equals the live return', () => {
  const { combat, enemy } = live('blightHound');
  Object.assign(enemy, { ratings: {}, persistentPoise: { value: 0, max: 0 } });
  Object.assign(combat.player, { block: 999, persistentPoise: { value: 20, max: 20 } });
  const damage = previewCard(combat, 'cx1', enemy.id).values.find(row => row.op === 'damage');
  const single = previewCard(combat, 'cx1', enemy.id).values.find(row => row.op === 'damage').totalDamage;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cx1' });
  Object.assign(combat.player, { block: 999, persistentPoise: { value: 20, max: 20 } });
  dispatch(combat, { type: 'setReactions', enabled: false });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const events = combat.eventLog.slice(start);
  const taken = events.filter(e => e.type === 'damageDealt' && e.targetId === 'player');
  assert.equal(taken.length, 2, 'two hits land');
  const returned = events.filter(e => e.type === 'damageDealt' && e.cardId === 'core.counter');
  assert.ok(returned.length);
  assert.equal(returned.reduce((sum, e) => sum + e.hpLoss, 0), damage.damageReceipt.hits.reduce((sum, hit) => sum + (hit.hpLoss ?? hit.hp ?? 0), 0));
  assert.equal(single, damage.totalDamage);
});

test('a covered hit that breaks Poise still gets its return once; the break then clears the Counter', () => {
  const { combat, enemy } = live();
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cx1' });
  Object.assign(combat.player, { block: 0, persistentPoise: { value: 1, max: 20 } });
  dispatch(combat, { type: 'setReactions', enabled: false });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const events = combat.eventLog.slice(start);
  assert.ok(events.some(e => e.type === 'poiseBroken' && e.targetId === 'player'), 'the hit broke Poise');
  const returned = events.filter(e => e.type === 'damageDealt' && e.cardId === 'core.counter');
  assert.ok(returned.length > 0, 'the return fired');
  assert.equal(returned.length, 1, 'once');
  assert.equal(combat.player.combatCounter, undefined, 'the break cleared the Counter');
});

test('a Core Counter return ignores the target\'s Vulnerable: 8 incoming returns exactly 6 before protection', () => {
  const { combat, enemy } = live();
  Object.assign(combat.player, { ratings: {}, ratingSources: [], statuses: {} });
  enemy.statuses = { vulnerable: { stacks: 2 } };
  enemy.persistentPoise = { value: 0, max: 0 };
  const carrier = { skipRatingBonus: true, counterReturnAttack: true, combatReaction: true,
    combatProfile: { camp: 'physical', maneuver: 'counter', damageType: 'slashing', range: 'melee', targeting: 'single' } };
  const receipt = profileDamageReceipt(combat, combat.player, enemy, counterReturn(combat, 8, true).hp, carrier);
  assert.equal(receipt.damageReceipt.hits[0].incoming, 6);
  assert.equal(receipt.hpLoss, 6);
});

import { counterPreviewAgainst } from '../src/engine/counterRule.js';
import { previewIntent } from '../src/engine/combat.js';
test('multi-hit preview grants each hit its Counter Block and carries Vulnerable only after the break (Cinder Mantis, 0 Block, 2 Poise)', () => {
  const { combat, enemy } = live('cinderMantis');
  Object.assign(enemy, { ratings: {}, ratingSources: [], statuses: {} });
  combat.player.combatStance = { maneuver: 'counter', camp: 'physical', range: 'melee' };
  Object.assign(combat.player, { block: 0, statuses: {}, ratings: {}, ratingSources: [], persistentPoise: { value: 2, max: 20 } });
  assert.equal(enemy.intent.moveId, 'scythePair');
  const row = counterPreviewAgainst(combat, enemy, previewIntent(combat, enemy.id));
  assert.equal(row.hits, 2);
  assert.equal(row.incoming, 10, 'Vulnerable from the Poise break lands only after hit 2 completes');
  assert.equal(row.hp, 6); assert.equal(row.poise, 2); assert.equal(row.block, 2);
});

test('the Counter preview carries the return\'s Poise damage and the Block it adds (8-damage attack: Poise 3, Block +2)', () => {
  const { combat, enemy } = live();
  const damage = previewCard(combat, 'cx1', enemy.id).values.find(row => row.op === 'damage');
  assert.equal(damage.counterReturn.poise, 3);
  assert.equal(damage.counterReturn.block, 2);
  assert.equal(damage.counterReturn.hp, 6);
});

import { cardDetailHtml } from '../src/ui/components/card.js';
import { t } from '../src/ui/strings.js';
test('the Counter help is profile-aware: Core 2 says half the incoming hit, legacy keeps Guard or Ward absorption', () => {
  const core = cardDetailHtml(reg, { cardId: 'core.counter' });
  assert.ok(core.includes(t('card.counter.help.core')) || /Counter coverage/.test(core), 'Core reads its own wording or coverage');
  assert.doesNotMatch(core, /after full Guard or Ward absorption/);
  assert.match(t('card.counter.help.core'), /half its incoming damage/);
  assert.match(t('card.counter.help.legacy'), /after full Guard or Ward absorption/);
  const legacyReg = createRegistries(contentBundle);
  const legacyCounter = contentBundle.cards.find(c => c.combatProfile?.maneuver === 'counter' && !c.counterCoverage);
  if (legacyCounter) assert.match(cardDetailHtml(legacyReg, { cardId: legacyCounter.id }), /after full Guard or Ward absorption/);
});

test('the Counter face token reads the return (6), not the post-protection HP loss', () => {
  const { combat, enemy } = live();
  const row = previewCard(combat, 'cx1', enemy.id).values.find(v => v.op === 'damage');
  assert.equal(row.value, 6); assert.equal(row.totalDamage, 6); assert.deepEqual(row.hitDamages, [6]);
});

test('the Counter preview answers a covered Attack (6) but not an uncovered area Sweep (wyrmLord tailSweep)', () => {
  const sweep = live('wyrmLord');
  assert.equal(sweep.enemy.intent.moveId, 'tailSweep');
  const row = previewCard(sweep.combat, 'cx1', sweep.enemy.id).values.find(v => v.op === 'damage');
  assert.equal(row.counterReturn, undefined, 'no return previewed for an uncovered hit');
  const soldier = live();
  assert.equal(previewCard(soldier.combat, 'cx1', soldier.enemy.id).values.find(v => v.op === 'damage').counterReturn.hp, 6);
});

test('multi-hit preview starts from the player after the Counter\'s own Block, so Poise breaks when live play breaks it', () => {
  const heavy = { ...contentBundle, enemies: contentBundle.enemies.map(row => row.id === 'blightHound'
    ? { ...row, firstMove: 'lunge', moves: { ...row.moves, lunge: { ...row.moves.lunge, damage: 7 } } } : row) };
  const heavyReg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(heavy, profile)), profile);
  const run = createRunState({ registries: heavyReg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: heavyReg, run, rng: createRng(511), enemyIds: ['blightHound'] });
  const enemy = combat.enemies[0];
  Object.assign(enemy, { hp: 500, maxHp: 500, statuses: {}, ratings: {}, ratingSources: [], persistentPoise: { value: 0, max: 0 }, basePrecisionBonus: 1000 });
  combat.player.basePrecisionBonus = 1000; // opposed hit rolls (#2192): both the enemy's attack and the Counter's return must land
  combat.piles.hand.push({ instanceId: 'cx1', cardId: 'core.counter' });
  const poise = { value: 6, max: 20 };
  Object.assign(combat.player, { block: 0, statuses: {}, ratings: {}, ratingSources: [], persistentPoise: { ...poise } });
  const damage = previewCard(combat, 'cx1', enemy.id).values.find(row => row.op === 'damage');
  assert.ok(damage.counterReturn, 'the Counter return is previewed');
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cx1' });
  Object.assign(combat.player, { persistentPoise: { ...poise } });
  dispatch(combat, { type: 'setReactions', enabled: false });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const returned = combat.eventLog.slice(start).filter(e => e.type === 'damageDealt' && e.cardId === 'core.counter');
  assert.equal(returned.reduce((sum, e) => sum + e.hpLoss + (e.poiseAbsorbed || 0), 0), damage.counterReturn.hp, 'preview == live');
});

function liveWith(cardId) {
  const { combat, enemy } = live();
  combat.piles.hand.push({ instanceId: 'cy1', cardId });
  return { combat, enemy };
}

test('a spell Counter (frostCounter) arms in Core: it previews the computed return and still marks its SP shift', () => {
  const { combat, enemy } = liveWith('frostCounter');
  const view = previewCard(combat, 'cy1', enemy.id);
  assert.ok(view.counterReturn?.hp > 0 && !view.counterReturn.uncovered, 'owner 2026-10-19: a spell Counter with coverage returns');
  assert.equal(view.costShift, -1, 'the reaction-from-hand discount reads from the authored cost (1 -> 0)');
});

function playSpellCounter(enemyId = 'wanderingSoldier') {
  const { combat, enemy } = live(enemyId);
  combat.piles.hand.push({ instanceId: 'cz1', cardId: 'frostCounter' });
  Object.assign(combat.player, { mana: 9, maxMana: 9 });
  const view = previewCard(combat, 'cz1', enemy.id);
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cz1' });
  Object.assign(combat.player, { block: 5, persistentPoise: { value: 20, max: 20 } });
  dispatch(combat, { type: 'setReactions', enabled: false });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  return { combat, enemy, view, events: combat.eventLog.slice(start) };
}

test('live: a spell Counter keeps the prepared stance, arms, is consumed, and its magical return equals the preview', () => {
  const { combat, view, events } = playSpellCounter();
  const triggered = events.find(e => e.type === 'combatCounterTriggered' && e.cardId === 'frostCounter');
  assert.ok(triggered, 'a covered attack triggers the spell Counter');
  assert.ok(events.some(e => e.type === 'combatCounterConsumed' && e.cardId === 'frostCounter'), 'consumed');
  assert.equal(combat.player.combatCounter?.charges ?? 0, 0, 'no charge left');
  const dealt = events.find(e => e.type === 'damageDealt' && e.cardId === 'frostCounter');
  assert.ok(events.some(e => e.type === 'attackHit' && e.cardId === 'frostCounter' && e.opposed), 'the return rolls to hit');
  assert.equal(triggered.amount, dealt.damageReceipt.hits[0].incoming, 'the receipt carries the Counter amount');
  assert.ok(dealt.damageReceipt.hits[0].magical > 0 && dealt.damageReceipt.hits[0].physical === 0, 'the return is a magical attack (PR, not AR)');
  assert.equal(triggered.wardDamage, 0, 'Core fixes the return to HP and Poise (authored Ward/Flux do not add)');
  assert.equal(triggered.amount, view.counterReturn.hp, 'preview == live HP return');
  assert.equal(triggered.poiseDamage, view.counterReturn.poise, 'preview == live Poise return');
});

test('a spell Counter plays into the prepared stance (not Counter stance), as before', () => {
  const { combat } = live();
  combat.piles.hand.push({ instanceId: 'cz2', cardId: 'frostCounter' });
  Object.assign(combat.player, { mana: 9, maxMana: 9 });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cz2' });
  assert.equal(combat.player.combatStance.maneuver, 'prepared');
  assert.ok(combat.player.combatCounter, 'armed');
});

test('a spell Counter returns once per owner cycle (counterReturnSpent) and not against an uncovered attack', () => {
  const spent = live();
  spent.combat.piles.hand.push({ instanceId: 'cz3', cardId: 'frostCounter' });
  Object.assign(spent.combat.player, { mana: 9, maxMana: 9 });
  spent.combat.player.combatCounterReturnedCycle = spent.combat.player.combatOwnerCycle || 0;
  assert.equal(previewCard(spent.combat, 'cz3', spent.enemy.id).counterReturn?.uncovered, true, 'already returned this cycle: no second return');
  assert.equal(previewCard(spent.combat, 'cz3', spent.enemy.id).counterReturn?.hp, undefined);
  const wide = live('wyrmLord');
  wide.combat.piles.hand.push({ instanceId: 'cz4', cardId: 'frostCounter' });
  Object.assign(wide.combat.player, { mana: 9, maxMana: 9 });
  assert.equal(wide.enemy.intent.moveId, 'tailSweep');
  assert.deepEqual(previewCard(wide.combat, 'cz4', wide.enemy.id).counterReturn, { uncovered: true }, 'tailSweep is Area: not covered');
  dispatch(wide.combat, { type: 'playCard', cardInstanceId: 'cz4' });
  dispatch(wide.combat, { type: 'setReactions', enabled: false });
  const start = wide.combat.eventLog.length;
  dispatch(wide.combat, { type: 'endTurn' });
  assert.equal(wide.combat.eventLog.slice(start).some(e => e.type === 'combatCounterTriggered'), false, 'uncovered: no return');
});

test('Core 2 fixed return is not rewritten by the legacy Impact edge (lowGuardRiposte poise stays 3, not 6)', () => {
  const { combat, enemy } = liveWith('lowGuardRiposte');
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cy1' });
  Object.assign(combat.player, { block: 5, persistentPoise: { value: 20, max: 20 } });
  dispatch(combat, { type: 'setReactions', enabled: false });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const triggered = combat.eventLog.slice(start).find(e => e.type === 'combatCounterTriggered' && e.cardId === 'lowGuardRiposte');
  assert.equal(triggered.amount, 6);
  assert.equal(triggered.poiseDamage, 3);
});

test('a zero-HP Counter grade (Crimson Reprisal rank 3) shows the computed Poise return, not its authored Poise rows', () => {
  const { combat, enemy } = live();
  combat.piles.hand.push({ instanceId: 'cr1', cardId: 'progression-crimson-reprisal', abilityRank: 3 });
  const view = previewCard(combat, 'cr1', enemy.id);
  const rows = view.values.filter(row => row.op === 'poiseDamage');
  assert.ok(rows.length > 0, 'the grade authors Poise rows');
  assert.equal(rows.reduce((sum, row) => sum + row.value, 0), 3, 'one computed Poise return (8 incoming -> 3)');
});

test('the Counter\'s pre-hit Block honors the Unbreakable cap (29 Block, cap 30, +2 stops at 30)', () => {
  const { combat } = live();
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cx1' });
  Object.assign(combat.player, { block: 29, persistentPoise: { value: 20, max: 20 }, statuses: { unbreakable: { stacks: 1 } } });
  dispatch(combat, { type: 'setReactions', enabled: false });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const gained = combat.eventLog.slice(start).find(e => e.type === 'blockGained' && e.source === 'counter');
  assert.equal(gained.total, 30, 'capped at 30, not 31');
  assert.equal(gained.amount, 1);
});

test('Counter preview grants capped Block like live: Unbreakable at 29/30 previews +1, not +2', () => {
  let { combat, enemy } = live();
  Object.assign(combat.player, { block: 20, statuses: { unbreakable: { stacks: 1 } }, persistentPoise: { value: 20, max: 20 } }); // the card's own 9 Block brings it to 29
  const damage = previewCard(combat, 'cx1', enemy.id).values.find(row => row.op === 'damage');
  const fresh = live(); combat = fresh.combat;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cx1' });
  Object.assign(combat.player, { block: 29, statuses: { unbreakable: { stacks: 1 } }, persistentPoise: { value: 20, max: 20 } });
  dispatch(combat, { type: 'setReactions', enabled: false });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const liveBlock = combat.eventLog.slice(start).filter(e => e.type === 'blockGained' && e.source === 'counter').reduce((n, e) => n + e.amount, 0);
  assert.equal(liveBlock, 1);
  assert.equal(damage.counterReturn.block, liveBlock, 'preview == live');
});

import { cardFaceLines } from '../src/model/cardFaceText.js';
function faceAgainst12(cardId) {
  const { combat, enemy } = live();
  combat.piles.hand.push({ instanceId: 'cf1', cardId });
  Object.assign(combat.player, { mana: 9, maxMana: 9 });
  enemy.intent.damage = 12;
  const view = previewCard(combat, 'cf1', enemy.id);
  const lines = cardFaceLines(view.resolvedDefinition, view, reg) || [];
  return { view, text: lines.map(line => line.html).join(' | ').replace(/<[^>]+>/g, '') };
}

test('the card face renders the computed return against a 12-damage Attack (core.counter, lowGuardRiposte)', () => {
  for (const cardId of ['core.counter', 'lowGuardRiposte']) {
    const { view, text } = faceAgainst12(cardId);
    const r = view.counterReturn;
    assert.ok(r, `${cardId}: return computed`);
    assert.match(text, new RegExp(`\\b${r.hp}\\b`), `${cardId}: HP return ${r.hp} on the face`);
    assert.match(text, new RegExp(`\\b${r.poise}\\b[^|]*Poise|Poise[^|]*\\b${r.poise}\\b`), `${cardId}: Poise return ${r.poise} on the face`);
    if (r.advantaged && r.block > 0) assert.match(text, new RegExp(`\\+${r.block}\\b[^|]*Block`), `${cardId}: Block +${r.block}`);
  }
});

test('Counters with authored coverage get eligibility-aware help and keep the coverage details', () => {
  const html = cardDetailHtml(regs.wanderingSoldier, { cardId: 'frostCounter' });
  assert.match(html, /Counter coverage:/);
  // frostCounter is a spell Counter that arms in Core (owner 2026-10-19), so the help promises the Core return.
  assert.match(html, /half its incoming damage/);
  assert.match(cardDetailHtml(regs.wanderingSoldier, { cardId: 'core.counter' }), /half its incoming damage/);
  assert.doesNotMatch(html, /requires all damage and status pressure resisted|after all covered damage and status pressure is resisted/);
});

test('the face lists only what live resolution delivers: no legacy Smash, Prone or zero-Poise lines on Core Counters', () => {
  for (const [cardId, rank] of [['progression-crimson-reprisal', 3], ['lowGuardRiposte', undefined]]) {
    const { combat, enemy } = live();
    combat.piles.hand.push({ instanceId: 'cf2', cardId, ...(rank ? { abilityRank: rank } : {}) });
    enemy.intent.damage = 12;
    const view = previewCard(combat, 'cf2', enemy.id);
    const text = (cardFaceLines(view.resolvedDefinition, view, reg) || []).map(line => line.html).join(' | ').replace(/<[^>]+>/g, '');
    assert.ok(text.length > 0, `${cardId}: face builds`);
    assert.doesNotMatch(text, /against Smash|while Prone/, `${cardId}: ${text}`);
    assert.doesNotMatch(text, /\b0 Poise/, `${cardId}: ${text}`);
  }
});

test('preview follows live eligibility: every Counter that arms (spell Counters included) shows its return', () => {
  for (const cardId of ['frostCounter', 'core.counter', 'lowGuardRiposte']) {
    const { view } = faceAgainst12(cardId);
    assert.ok(view.counterReturn?.hp > 0, `${cardId} previews its return`);
  }
});

test('a revealed attack the Counter does not cover (wyrmLord tailSweep) shows no return at all, not the printed amount', () => {
  const { combat, enemy } = live('wyrmLord');
  assert.equal(enemy.intent.moveId, 'tailSweep');
  const view = previewCard(combat, 'cx1', enemy.id);
  assert.deepEqual(view.counterReturn, { uncovered: true }, "the view marks the read uncovered (no computed return)");
  const row = view.values.find(v => v.op === 'damage');
  assert.equal(row.totalDamage, 0, 'no printed return either');
  assert.equal(row.counterReturn, undefined);
});

test('Crimson Reprisal rank 3 leaves no orphaned condition line once the Core return zeroes its conditional row', () => {
  const { combat, enemy } = live();
  combat.piles.hand.push({ instanceId: 'cf3', cardId: 'progression-crimson-reprisal', abilityRank: 3 });
  enemy.intent.damage = 12;
  const view = previewCard(combat, 'cf3', enemy.id);
  const text = (cardFaceLines(view.resolvedDefinition, view, reg) || []).map(line => line.html).join(' | ').replace(/<[^>]+>/g, '');
  assert.doesNotMatch(text, /If HP lost[^|]*:\s*(\||$)/, text);
  assert.doesNotMatch(text, /If HP lost/, text);
});

function supportFace(enemyId, setup) {
  const { combat, enemy } = live(enemyId);
  combat.piles.hand.push({ instanceId: 'cs1', cardId: 'lowGuardRiposte' });
  Object.assign(combat.player, { mana: 9, maxMana: 9 });
  setup?.(enemy);
  const view = previewCard(combat, 'cs1', enemy.id);
  return { view, text: (cardFaceLines(view.resolvedDefinition, view, regs[enemyId]) || []).map(line => line.html).join(' | ').replace(/<[^>]+>/g, '') };
}

test('a support-only Core Counter (lowGuardRiposte) vs an uncovered revealed attack shows no return and no Prone bonus', () => {
  const { view, text } = supportFace('wyrmLord');
  assert.equal(view.counterReturn?.uncovered, true, 'the uncovered state is kept');
  assert.doesNotMatch(text, /Return|\bPoise\b|while Prone|against Smash/, text);
});

test('a support-only Core Counter vs a hidden intent keeps the authored payload; vs a covered attack shows the computed return', () => {
  const hidden = supportFace('wanderingSoldier', enemy => { enemy.intent = null; });
  assert.equal(hidden.view.counterReturn, undefined, 'hidden: no computed return');
  assert.match(hidden.text, /Poise/, hidden.text);
  const covered = supportFace('wanderingSoldier');
  assert.ok(covered.view.counterReturn?.poise > 0 && !covered.view.counterReturn.uncovered);
  assert.match(covered.text, /Poise/, covered.text);
});

test('a Counter already returned this owner cycle previews no return, and live agrees (once per cycle)', () => {
  const { combat, enemy } = live();
  combat.player.combatCounterReturnedCycle = combat.player.combatOwnerCycle || 0;
  const view = previewCard(combat, 'cx1', enemy.id);
  const row = view.values.find(r => r.op === 'damage');
  assert.equal(row.counterReturn, undefined, 'no computed return on the damage row');
  assert.equal(row.totalDamage, 0, 'the face token reads no return, like an uncovered hit');
  const text = (cardFaceLines(view.resolvedDefinition, view, reg) || []).map(line => line.html).join(' | ').replace(/<[^>]+>/g, '');
  assert.doesNotMatch(text, /Return \d|Return damage/, text);
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cx1' });
  Object.assign(combat.player, { block: 5, persistentPoise: { value: 20, max: 20 } });
  dispatch(combat, { type: 'setReactions', enabled: false });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  assert.equal(combat.eventLog.slice(start).filter(e => e.type === 'damageDealt' && e.cardId === 'core.counter').length, 0, 'live returns nothing');
  const fresh = live();
  assert.equal(previewCard(fresh.combat, 'cx1', fresh.enemy.id).values.find(r => r.op === 'damage').counterReturn.hp, 6, 'control: an unspent Counter previews 6');
});

test('a Counter with several damage rows (rank-3 Guard Counter) previews the one computed return in one row, as live deals it', () => {
  const { combat, enemy } = live();
  combat.piles.hand.push({ instanceId: 'g1', cardId: 'guardCounter', abilityRank: 3, upgraded: false });
  combat.player.block = 5;
  const view = previewCard(combat, 'g1', enemy.id);
  const rows = view.values.filter(row => row.op === 'damage');
  assert.equal(rows.length, 2, 'the rank-3 card authors a base row and a conditional row');
  assert.equal(rows.reduce((sum, row) => sum + row.totalDamage, 0), 6, 'exactly one return of floor(0.5 x 8) + floor(0.25 x 8)');
  assert.equal(rows.filter(row => row.counterReturn).length, 1, 'the computed return sits in exactly one row');
  const text = (cardFaceLines(view.resolvedDefinition, view, reg) || []).map(line => line.html).join(' | ').replace(/<[^>]+>/g, '');
  assert.match(text, /Return 6 damage/, text);
  assert.doesNotMatch(text, /Return 8|Return 0|If you have Block/, text);
  dispatch(combat, { type: 'playCard', cardInstanceId: 'g1' });
  Object.assign(combat.player, { block: 5, persistentPoise: { value: 20, max: 20 } });
  dispatch(combat, { type: 'setReactions', enabled: false });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const returned = combat.eventLog.slice(start).filter(e => e.type === 'damageDealt' && e.targetId === enemy.id);
  assert.equal(returned.reduce((sum, e) => sum + e.hpLoss + (e.poiseAbsorbed || 0), 0), 6, 'live deals the same single return');
});

test('a Counter armed after this cycle\'s return was spent gains no live Block and previews no Block (control: unset gains 2)', () => {
  const run = spent => {
    const { combat, enemy } = live();
    dispatch(combat, { type: 'playCard', cardInstanceId: 'cx1' });
    Object.assign(combat.player, { block: 5, persistentPoise: { value: 20, max: 20 } });
    if (spent) combat.player.combatCounterReturnedCycle = combat.player.combatOwnerCycle || 0;
    dispatch(combat, { type: 'setReactions', enabled: false });
    const start = combat.eventLog.length;
    dispatch(combat, { type: 'endTurn' });
    return combat.eventLog.slice(start).filter(e => e.type === 'blockGained' && e.source === 'counter');
  };
  assert.equal(run(false)[0]?.amount, 2);
  assert.equal(run(true).length, 0);
  const { combat, enemy } = live();
  combat.piles.hand.push({ instanceId: 'cf9', cardId: 'core.counter' });
  Object.assign(combat.player, { mana: 9, maxMana: 9 });
  combat.player.combatCounterReturnedCycle = combat.player.combatOwnerCycle || 0;
  const view = previewCard(combat, 'cf9', enemy.id);
  const lines = cardFaceLines(view.resolvedDefinition, view, reg) || [];
  const text = lines.map(line => line.html).join(' | ').replace(/<[^>]+>/g, '');
  assert.doesNotMatch(text, /Block against it/);
});

test('guardCounter rank 3: a spent or uncovered read leaves no Return line on the face; covered shows only the computed Return', () => {
  const face = (soldier, spent) => {
    const { combat, enemy } = live(soldier ? 'wanderingSoldier' : 'wyrmLord');
    combat.piles.hand.push({ instanceId: 'gc3', cardId: 'guardCounter', abilityRank: 3 });
    Object.assign(combat.player, { mana: 9, maxMana: 9, block: 5 });
    if (spent) combat.player.combatCounterReturnedCycle = combat.player.combatOwnerCycle || 0;
    const view = previewCard(combat, 'gc3', enemy.id);
    const lines = cardFaceLines(view.resolvedDefinition, view, reg) || [];
    return lines.map(line => line.html).join(' | ').replace(/<[^>]+>/g, '');
  };
  assert.doesNotMatch(face(true, true), /Return/, 'spent');
  assert.doesNotMatch(face(false, false), /Return/, 'uncovered area Sweep');
  const covered = face(true, false);
  assert.match(covered, /Return 6 damage/);
  assert.doesNotMatch(covered, /Return \d+ damage[^|]*\|[^|]*Return/, 'covered: one Return row only');
});
