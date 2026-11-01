// Core 2 Precision stacks (owner decision, 2026-10-31): Precision = 1 + statMix + stacks; Evasion = 8 + DEX + 2 per Evade stack;
// an offensive stance entry grants exactly 1 stack; stacks lose 1 at the owner's turn start, Persistent stacks exempt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, previewCard, previewCardHit } from '../src/engine/combat.js';
import { attackHitPreview, resolveAttackHit, previewCardAttackHit, effectiveEvasion, precisionStatMix, precisionEntryGrant } from '../src/engine/stanceHit.js';
import { applyStatus, decayAtTurnStart, decayAtTurnEnd } from '../src/engine/statuses.js';
import { statusInstancePresentation } from '../src/ui/uiContent.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';
import { mechanics } from '../src/framework/data/mechanics.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const carrier = { combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' } };
const unlocks = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
function live(enemyId = 'wanderingSoldier') {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: unlocks });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: [enemyId] });
  return { combat, player: combat.player, enemy: combat.enemies[0] };
}
const plain = lines => lines.map(line => line.html.replace(/<[^>]+>/g, ''));

test('constants live in the editable accuracy block of mechanics.json', () => {
  assert.deepEqual({ ...mechanics.accuracy, note: undefined, precisionTooltip: undefined }, { evasionBase: 8, evadePerStack: 2, precisionStackValue: 1, precisionDecayPerTurn: 3, note: undefined, precisionTooltip: undefined });
});

test('Precision = 1 + statMix + stacks and Evasion = 8 + DEX + 2 per Evade stack', () => {
  const { combat, player, enemy } = live();
  Object.assign(player, { attributes: { dexterity: 2, strength: 0, wisdom: 0, intelligence: 0 }, level: 1, statuses: {} });
  Object.assign(enemy, { attributes: { dexterity: 3 }, statuses: {} });
  assert.equal(precisionStatMix(combat, player), 2);
  for (const stacks of [0, 1, 4]) {
    player.statuses = stacks ? { precision: { stacks } } : {};
    assert.equal(attackHitPreview(combat, player, enemy, carrier).accuracy, 1 + 2 + stacks, `${stacks} stacks`);
  }
  for (const stacks of [0, 1, 3]) {
    enemy.statuses = stacks ? { evade: { stacks } } : {};
    assert.equal(effectiveEvasion(combat, enemy), 8 + 3 + 2 * stacks, `${stacks} Evade`);
  }
  // Need = Evasion - Accuracy; hit on a natural 20 or (not a 1 and d20 >= need).
  player.statuses = { precision: { stacks: 1 } }; enemy.statuses = {};
  const hit = attackHitPreview(combat, player, enemy, carrier);
  assert.equal(hit.need, 11 - 4);
  // The itemised Precision the combat log receipt reads sums to the accuracy.
  assert.deepEqual(hit.precisionParts.map(p => [p.label, p.value]), [['base', 1], ['DEX', 1], ['level', 1], ['stacks', 1]]);
  assert.ok(!hit.precisionParts.some(p => p.label === 'stat mix'), 'the single stat mix line is gone');
  assert.equal(Math.round(hit.precisionParts.reduce((n, p) => n + p.value, 0) * 100) / 100, hit.accuracy);
  assert.equal(hit.hitChance, Math.floor(100 * 14 / 20), 'need 7: d20 7..20 hit');
});

test('an offensive stance entry grants exactly one stack; preview equals live', () => {
  assert.equal(precisionEntryGrant(null, null, 1), 1);
  assert.equal(precisionEntryGrant(null, null, 0), 0);
  const { combat, player, enemy } = live();
  const card = combat.piles.hand.find(row => row.cardId === 'core.strike');
  assert.ok(card);
  const preview = previewCard(combat, card.instanceId, enemy.id), shown = previewCardHit(combat, card.instanceId, enemy.id);
  assert.equal(preview.entryPrecision, 1);
  primeAccuracyRolls(combat);
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: enemy.id });
  assert.equal(player.statuses.precision?.stacks, 1, 'live entry grant');
  const actual = combat.eventLog.filter(row => row.type === 'attackHit' || row.type === 'attackMissed').at(-1);
  assert.equal(actual.accuracy, shown.accuracy, 'preview == live accuracy');
  assert.equal(actual.evasion, shown.evasion);
  assert.equal(actual.hitChance, shown.hitChance);
  // The projected-entry preview prices exactly one more stack than the current state.
  delete player.combatStance; player.statuses = {};
  const base = attackHitPreview(combat, player, enemy, carrier).accuracy;
  assert.equal(previewCardAttackHit(combat, player, enemy, carrier).accuracy, base + 1);
});

test('Precision loses 3 per owner turn start (5 -> 2 -> 0, 2 -> 0), floored at 0, once per turn, not at turn end', () => {
  const { combat, player, enemy } = live();
  player.statuses = {}; enemy.statuses = {};
  applyStatus(combat, player, 'precision', 5, player);
  applyStatus(combat, enemy, 'precision', 2, enemy);
  decayAtTurnEnd(combat, player);
  assert.equal(player.statuses.precision.stacks, 5, 'turn end does not decay');
  const seen = [];
  for (let i = 0; i < 2; i++) {
    combat.turn++; decayAtTurnStart(combat, player); decayAtTurnStart(combat, player); // idempotent within a turn
    seen.push(player.statuses.precision?.stacks ?? 0);
  }
  assert.deepEqual(seen, [2, 0]);
  assert.equal(enemy.statuses.precision.stacks, 2, "another owner's boundary does not touch the enemy's stacks");
  decayAtTurnStart(combat, enemy);
  assert.equal(enemy.statuses.precision, undefined, 'enemy Precision 2 -> 0 (floored, never negative)');
});

test('Persistent Precision stacks are exempt from decay', () => {
  const { combat, player } = live();
  applyStatus(combat, player, 'precision', 2, player, { tags: ['trait:persistent'] });
  applyStatus(combat, player, 'precision', 3, player);
  for (let i = 0; i < 6; i++) { combat.turn++; decayAtTurnStart(combat, player); }
  assert.deepEqual(player.statuses.precision, { stacks: 2, persistentStacks: 2 });
});

test('buff cards grant their authored Precision, the face prints +N Precision, and the badge shows N', () => {
  const grants = { 'core.glimpse': 2, 'core.wardingGlance': 1, 'core.steadyGuard': 1 };
  for (const [id, n] of Object.entries(grants)) {
    const def = reg.cards.get(id);
    assert.ok(def.effects.some(e => e.op === 'applyStatus' && e.status === 'precision' && e.target === 'self' && e.stacks === n), id);
    assert.ok(n >= 1 && n <= 3);
    assert.ok(plain(cardFaceLines(def, null, reg)).join(' | ').includes(`+${n} Precision`), `${id} face`);
    const { combat, player, enemy } = live();
    player.energy = 10; player.stamina = 10; player.statuses = {};
    combat.piles.hand.push({ cardId: id, instanceId: 'buff', upgraded: false });
    // A card that also changes stance adds the one-stack entry grant on top of its authored buff.
    const entry = previewCard(combat, 'buff', enemy.id).entryPrecision || 0;
    dispatch(combat, { type: 'playCard', cardInstanceId: 'buff', ...(reg.cards.get(id).effects.some(e => e.target === 'enemy') ? { targetId: enemy.id } : {}) });
    const stacks = player.statuses.precision?.stacks;
    assert.equal(stacks, n + entry, `${id} live grant (${n} authored + ${entry} entry)`);
    assert.ok(entry <= 1);
    const view = statusInstancePresentation(reg.statuses.get('precision'), player.statuses.precision, combat);
    assert.equal(view.valueText, String(stacks), `${id} badge value`);
    assert.match(view.tooltip, /^Each stack adds 1 Precision\. Loses 3 stacks at the start of your turn\./);
  }
});

test('hit chances: Reaver vs wanderingSoldier both ways, fellWarden and glassRegent vs the player (no longer 95% everywhere)', () => {
  // Stack-free baseline and after one stance-entry stack (the 1-stack column is what a first attack of the fight prices).
  const table = {};
  for (const id of ['wanderingSoldier', 'fellWarden', 'glassRegent']) {
    const { combat, player, enemy } = live(id);
    const row = {};
    for (const stacks of [0, 1]) {
      player.statuses = enemy.statuses = {};
      player.statuses = stacks ? { precision: { stacks } } : {}; enemy.statuses = stacks ? { precision: { stacks } } : {};
      row[stacks] = { playerHits: attackHitPreview(combat, player, enemy, carrier).hitChance, enemyHits: attackHitPreview(combat, enemy, player, carrier).hitChance };
    }
    table[id] = row;
  }
  assert.deepEqual(table, {
    wanderingSoldier: { 0: { playerHits: 80, enemyHits: 70 }, 1: { playerHits: 85, enemyHits: 75 } },
    fellWarden: { 0: { playerHits: 80, enemyHits: 90 }, 1: { playerHits: 85, enemyHits: 95 } },
    glassRegent: { 0: { playerHits: 80, enemyHits: 95 }, 1: { playerHits: 85, enemyHits: 95 } },
  });
  assert.ok(table.wanderingSoldier[1].enemyHits < 95, 'a level-1 enemy no longer hits 95%');
});

test('legacy (default contentBundle, no Core 2 profile) is unchanged: linear Precision, old Evasion, no Precision decay', () => {
  const legacyReg = createRegistries(contentBundle);
  const run = createRunState({ registries: legacyReg, classId: 'reaver', seed: 511 });
  const combat = createRunCombat({ registries: legacyReg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const { player } = combat, enemy = combat.enemies[0], out = [];
  for (const stacks of [0, 2]) for (const evade of [0, 2]) {
    player.statuses = stacks ? { precision: { stacks } } : {}; enemy.statuses = evade ? { evade: { stacks: evade } } : {};
    const h = attackHitPreview(combat, player, enemy, carrier);
    out.push([stacks, evade, h.accuracy, h.evasion, h.need, h.hitChance]);
  }
  // Captured from origin/dev (6d85a95500) before the Core 2 accuracy change.
  assert.deepEqual(out, [[0, 0, 5, 1, 4, 85], [0, 2, 5, 7, 10, 55], [2, 0, 7, 1, 2, 95], [2, 2, 7, 7, 8, 65]]);
  player.statuses = { precision: { stacks: 3 } };
  decayAtTurnEnd(combat, player); combat.turn = (combat.turn || 0) + 1; decayAtTurnStart(combat, player);
  assert.equal(player.statuses.precision.stacks, 3, 'legacy Precision does not decay');
  const hit = resolveAttackHit(combat, player, enemy, carrier);
  assert.deepEqual([hit.d20, hit.hit, hit.accuracy, hit.evasion, hit.need], [10, true, 8, 7, 7]);
});

test('the receipt itemises the stat mix one stat per line and the lines sum to the total', () => {
  const { combat, player, enemy } = live();
  // STR 5 x0.1 = 0.5, INT 3 x0.2 = 0.6, WIS 2 x0.2 = 0.4, DEX 0 skipped, level 14: 15.5 floors to 15, so rounding is -0.5.
  Object.assign(player, { attributes: { dexterity: 0, strength: 5, wisdom: 2, intelligence: 3 }, level: 14, statuses: {} });
  Object.assign(enemy, { attributes: { dexterity: 3 }, statuses: {} });
  const hit = attackHitPreview(combat, player, enemy, carrier);
  const by = Object.fromEntries(hit.precisionParts.map(p => [p.label, p]));
  assert.equal(by.STR.value, 0.5); assert.equal(by.STR.note, '5 ×0.1');
  assert.equal(by.INT.value, 0.6); assert.equal(by.WIS.value, 0.4); assert.equal(by.level.value, 14);
  assert.ok(!('DEX' in by), 'a zero stat is skipped');
  assert.equal(by.rounding.value, -0.5);
  assert.ok(!('stat mix' in by));
  const sum = Math.round(hit.precisionParts.reduce((n, p) => n + p.value, 0) * 100) / 100;
  assert.equal(sum, hit.accuracy);
  assert.equal(hit.accuracy, 1 + precisionStatMix(combat, player));
});
