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
  // A plain 8-damage Attack: no rating, status or Poise noise on either side of the exchange.
  Object.assign(enemy, { hp: 500, maxHp: 500, statuses: {}, ratings: { poise: 20 }, ratingSources: [], attributes: { dexterity: 0 } });
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
  Object.assign(enemy, { hp: 500, maxHp: 500, statuses: {}, ratings: {}, ratingSources: [], persistentPoise: { value: 0, max: 0 } });
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

test('a support-only Counter (frostCounter) previews the conditional return and the SP shift marker', () => {
  const { combat, enemy } = liveWith('frostCounter');
  const view = previewCard(combat, 'cy1', enemy.id);
  assert.ok(view.counterReturn, 'the return is previewed without a damage opcode');
  assert.equal(view.counterReturn.incoming > 0, true);
  assert.equal(view.costShift, -1, 'the reaction-from-hand discount reads from the authored cost (1 -> 0)');
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
