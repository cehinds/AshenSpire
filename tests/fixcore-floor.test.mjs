// Owner, 2026-10-18 16:05: "Floor operator so that there are no decimal values".
// Core 2 multiplies by Vulnerable x1.25, matching stance x1.25, Poise x0.75 and Weak AR x0.75.
// Every applied or shown quantity is a whole number, floored once at the end of its chain.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { applyStatus } from '../src/engine/statuses.js';
import { fixCoreRules } from '../src/model/fixCoreMechanics.js';
import { sourceRatingValue } from '../src/model/combatRatings.js';
import { stanceEntryBonuses } from '../src/model/stanceRules.js';
import { attackHitPreview } from '../src/engine/stanceHit.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

const CARD = 'twinbladeFlurry';
function fight({ amount, vulnerable = false, stance = false, poise = false }) {
  const registries = createRegistries({ ...contentBundle,
    cards: contentBundle.cards.map(card => card.id === CARD
      ? { ...card, effects: [{ op: 'damage', target: 'enemy', amount, hits: 1 }], textTemplate: 'Deal {damage} damage.' } : card) });
  const actor = { classId: 'reaver', hp: 500, maxHp: 500, mana: 10, maxMana: 10, energyMax: 3, drawPerTurn: 1,
    deck: [{ instanceId: 'flurry', cardId: CARD }], relicIds: [] };
  const combat = createCombat({ registries, rng: createRng(50), enemyIds: ['wanderingSoldier'], ratingsRules: null,
    combatExpansionVersion: 2, player: actor });
  combat.fixCoreRules = structuredClone(fixCoreRules(combat));
  combat.fixCoreRules.stance.effectivenessMultiplier = 1.25; // the owner's Core 2 value
  const enemy = combat.enemies[0];
  enemy.hp = enemy.maxHp = 1000; enemy.block = 0; enemy.poiseMeter = { value: 0, max: 1000 };
  if (poise) enemy.persistentPoise = { value: 500, max: 500 };
  if (stance) combat.player.combatStance = { camp: 'physical', maneuver: 'attack' };
  if (vulnerable) applyStatus(combat, enemy, 'vulnerable', 1, combat.player);
  primeAccuracyRolls(combat); // a natural 20 always connects, whatever the defender rolls
  return { combat, enemy };
}
// Previewed hit and applied HP loss from one fresh fight each, so they cannot influence each other.
function previewAndApply(options) {
  const f = fight(options);
  const preview = previewCard(f.combat, 'flurry', f.enemy.id).values.find(v => v.op === 'damage');
  const receipt = preview.damageReceipt.hits[0];
  const before = f.enemy.hp;
  dispatch(f.combat, { type: 'playCard', cardInstanceId: 'flurry', targetId: f.enemy.id });
  return { shown: preview.hitDamages[0], incoming: receipt.incoming, dealt: before - f.enemy.hp, receipt };
}

test('Vulnerable x1.25 on 7 is 8 when previewed and when applied', () => {
  const r = previewAndApply({ amount: 7, vulnerable: true });
  assert.equal(r.shown, 8); assert.equal(r.dealt, 8);
});
test('matching stance x1.25 on 5 is 6 when previewed and when applied', () => {
  const r = previewAndApply({ amount: 5, stance: true });
  assert.equal(r.shown, 6); assert.equal(r.dealt, 6);
});
test('Poise x0.75 on 7 is 5 when previewed and when applied', () => {
  const r = previewAndApply({ amount: 7, poise: true });
  assert.equal(r.incoming, 7);
  assert.equal(r.shown, 5); assert.equal(r.dealt, 5);
});
test('Vulnerable and stance floor once: 6 x1.25 x1.25 is 9, not 8', () => {
  const r = previewAndApply({ amount: 6, vulnerable: true, stance: true });
  assert.equal(r.incoming, 9); // flooring after each step would give floor(floor(7.5) x 1.25) = 8
  assert.equal(r.shown, r.dealt);
});
test('with Poise as well the preview still equals the applied HP loss, and every receipt line is whole', () => {
  const r = previewAndApply({ amount: 6, vulnerable: true, stance: true, poise: true });
  // The offensive chain floors once to the incoming 9; Poise then mitigates that whole number: floor(9 x 0.75) = 6.
  assert.equal(r.incoming, 9); assert.equal(r.shown, 6); assert.equal(r.dealt, 6);
  for (const line of r.receipt.sources) for (const key of ['requested', 'effective', 'amount']) {
    if (line[key] !== undefined) assert.ok(Number.isInteger(line[key]), `${line.id}.${key} = ${line[key]}`);
  }
  const mitigation = r.receipt.sources.find(line => line.mechanicId === 'defense.poiseProtection');
  assert.equal(mitigation.multiplier, 0.75); // a factor, not a quantity, so it stays 0.75
  assert.equal(r.receipt.sources.some(line => line.id === 'rounding'), false);
});

test('Weak attack rating x0.75 is a whole number', () => {
  const f = fight({ amount: 5 });
  f.combat.player.ratings = { ar: 7, dr: 0, pr: 0, ward: 0, poise: 0 }; f.combat.player.ratingSources = [];
  applyStatus(f.combat, f.combat.player, 'weak', 1, f.combat.player);
  assert.equal(sourceRatingValue(f.combat, f.combat.player, 'ar'), 5); // 7 x 0.75 = 5.25
});
test('a spell stance entry floors its Block share and keeps the rest as Barrier', () => {
  const f = fight({ amount: 5 });
  // Frost defend: entryProtection 3 x share 0.5 = 1.5 -> 1 (Math.round gave 2).
  const bonus = stanceEntryBonuses({ combatProfile: { camp: 'spell', maneuver: 'defend', school: 'frost', range: 'ranged' } }, f.combat);
  assert.equal(bonus.block, 1);
  assert.ok(Number.isInteger(bonus.barrier));
});
test('advantage and disadvantage hit chances are whole percentages', () => {
  const f = fight({ amount: 5 });
  const carrier = { combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' } };
  for (let dexterity = 0; dexterity <= 14; dexterity++) for (const flags of [{}, { accuracyAdvantage: true }, { accuracyDisadvantage: true }]) {
    const target = { ...f.enemy, statuses: {}, attributes: { dexterity }, combatStance: { maneuver: 'attack', camp: 'physical', range: 'melee' } };
    const hit = attackHitPreview(f.combat, { ...f.combat.player, ...flags }, target, carrier);
    assert.ok(Number.isInteger(hit.hitChance), `dexterity ${dexterity} ${JSON.stringify(flags)}: ${hit.hitChance}`);
  }
});

// A short scripted fight on the real Core 2 profile: no decimal in a damage or protection event.
const FACTOR_KEYS = new Set(['multiplier', 'stanceFactor']);
function decimals(value, path, out, seen = new Set()) {
  if (typeof value === 'number') { if (!Number.isInteger(value)) out.push(`${path}=${value}`); return out; }
  if (!value || typeof value !== 'object' || seen.has(value)) return out;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (FACTOR_KEYS.has(key) || key === 'value' && value.operation === 'multiply') continue;
    decimals(child, `${path}.${key}`, out, seen);
  }
  return out;
}
test('a scripted Core 2 fight logs no decimal damage, block or protection value', () => {
  const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  combat.fixCoreRules = structuredClone(fixCoreRules(combat));
  combat.fixCoreRules.stance.effectivenessMultiplier = 1.25;
  const target = combat.enemies[0];
  Object.assign(target, { hp: 500, maxHp: 500, block: 3, barrier: 0, statuses: {}, persistentWard: { value: 20, max: 20 }, persistentPoise: { value: 20, max: 20 }, attributes: { dexterity: 0 } });
  applyStatus(combat, target, 'vulnerable', 1, combat.player);
  applyStatus(combat, combat.player, 'weak', 1, combat.player);
  combat.player.persistentPoise = { value: 30, max: 30 };
  const problems = [];
  const checkPreview = (card, targetId, path) => {
    const { combatStatusRules, ...quantities } = previewCard(combat, card.instanceId, targetId);
    // This detached inspection receipt is configuration, not an applied
    // quantity. Keep its intentional coefficients and scan everything else.
    assert.equal(combatStatusRules.recovery.pendingRemoval, 0.25);
    assert.deepEqual(combatStatusRules.profiles.elemental, { constitution: 0.5, wisdom: 0, intelligence: 0.5 });
    assert.deepEqual(combatStatusRules.profiles.mental, { constitution: 0, wisdom: 0.75, intelligence: 0.25 });
    assert.deepEqual(combatStatusRules.profiles.curse, { constitution: 0, wisdom: 0.5, intelligence: 0.5 });
    decimals(quantities, `${path}.${card.cardId}`, problems);
  };
  for (const card of combat.piles.hand) checkPreview(card, target.id, 'preview');
  // Untargeted card faces (no enemy picked) are whole numbers too, matching stance included.
  for (const card of combat.piles.hand) checkPreview(card, null, 'face');
  const card = combat.piles.hand.find(row => row.cardId === 'core.strike' && previewCard(combat, row.instanceId, target.id).values.some(v => v.op === 'damage'));
  primeAccuracyRolls(combat);
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: target.id });
  if (!combat.pendingReaction) dispatch(combat, { type: 'endTurn' });
  const events = combat.eventLog.filter(event => /damage|hp|block|barrier|poise|ward/i.test(event.type));
  assert.ok(events.some(event => event.type === 'damageDealt'), 'the scripted fight deals damage');
  decimals(events, 'log', problems);
  assert.deepEqual(problems.filter(line => !/hitChance=0\.\d+$/.test(line)), []); // a 0..1 probability is not a quantity
});

test('the card-face stance context carries the game profile, so Core 2 faces floor like combat', async () => {
  const { fixCoreEnabled } = await import('../src/model/fixCoreMechanics.js');
  const gameProfile = resolveGameProfile('core');
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, gameProfile)), gameProfile);
  // Mirrors src/model/cardFaceText.js's stance-entry ctx.
  const faceCtx = { registries, combatExpansionVersion: 2, stanceRules: registries?.balance?.stanceRules, gameProfile: registries?.gameProfile };
  assert.equal(fixCoreEnabled(faceCtx), true);
  assert.equal(stanceEntryBonuses({ combatProfile: { camp: 'spell', maneuver: 'defend', school: 'frost', range: 'ranged' } }, faceCtx).block, 1);
});

test('logged Accuracy and Evasion are whole numbers under a stance factor', () => {
  const f = fight({ amount: 5 });
  const carrier = { combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' } };
  for (let dexterity = 0; dexterity <= 6; dexterity++) {
    const target = { ...f.enemy, statuses: {}, attributes: { dexterity }, stanceAdvantageRating: 1.25, combatStance: { maneuver: 'defend', camp: 'physical', range: 'melee' } };
    const hit = attackHitPreview(f.combat, f.combat.player, target, carrier);
    assert.ok(Number.isInteger(hit.evasion) && Number.isInteger(hit.accuracy) && Number.isInteger(hit.need), JSON.stringify({ e: hit.evasion, a: hit.accuracy }));
  }
});
