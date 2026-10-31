// Enemy weaknesses (owner, 2026-10-31; SPEC 5.3): authored data, hit classification, receipt stage, effects, UI rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { applyAttackDamage } from '../src/engine/actions.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { hitWeaknessTriggers } from '../src/engine/weaknesses.js';
import { weaknessProblems, WEAKNESS_EFFECTS } from '../src/model/enemyWeaknessRules.js';

const registries = createRegistries(contentBundle);
const pack = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/characters.json', import.meta.url), 'utf8'))
  .filter(row => row.tags?.includes('character.enemy'));

test('every enemy (registry and Core pack) has valid weaknesses, and the two agree', () => {
  const all = contentBundle.enemies.map(def => registries.enemies.get(def.id));
  assert.equal(all.length, 33);
  for (const def of all) {
    assert.deepEqual(weaknessProblems(def.weaknesses), [], def.id);
    const row = pack.find(r => r.id === def.id);
    assert.deepEqual(row?.enemy.weaknesses, def.weaknesses, `${def.id} pack matches registry`);
    if (row.tags.includes('tier.boss')) assert.equal(def.weaknesses.length, 1, `${def.id} boss has exactly one`);
  }
});

test('the validator refuses malformed weaknesses', () => {
  assert.ok(weaknessProblems([]).length);
  assert.ok(weaknessProblems([{ to: 'blunt', effect: 'stacks' }]).length, 'stacks needs a status');
  assert.ok(weaknessProblems([{ to: 'burn', effect: 'damage' }]).length, 'damage needs a hit trigger');
  assert.ok(weaknessProblems([{ to: 'paralysis', effect: 'tick' }]).length, 'paralysis has no tick');
  assert.ok(weaknessProblems([{ to: 'blunt', effect: 'stagger', amount: 150 }]).length);
  assert.ok(weaknessProblems([{ to: 'blunt', effect: 'nope' }]).length);
  assert.deepEqual(weaknessProblems([{ to: 'frost', effect: 'damage' }, { to: 'frost', effect: 'stacks' }]), []);
  assert.equal(WEAKNESS_EFFECTS.length, 6);
});

// ---- the live Core profile ----
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function liveCore(enemyId = 'wanderingSoldier') {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: [enemyId] });
  delete combat.player.combatStance;
  const target = combat.enemies[0];
  Object.assign(target, { block: 0, barrier: 0, persistentWard: null, persistentPoise: { value: 0, max: 20 }, gameProfilePoise: 0, statuses: {} });
  delete target.combatStance;
  return { combat, target };
}
function hit(carrier, { enemyId, weaknesses, statuses, amount = 10 } = {}) {
  const { combat, target } = liveCore(enemyId);
  if (weaknesses) target.weaknesses = weaknesses;
  if (statuses) target.statuses = statuses;
  const receipt = profileDamageReceipt(combat, combat.player, target, amount, { ...carrier, skipRatingBonus: true }, { roll: 0 });
  return { receipt, combat, target };
}
const blunt = { combatProfile: { camp: 'physical', damageType: 'blunt' } };
const slashing = { combatProfile: { camp: 'physical', damageType: 'slashing' } };
const fireSpell = { combatProfile: { camp: 'spell', damageType: 'fire', magicShare: 1 } };
const stageIds = r => r.receipt.damageReceipt.hits[0].sources.map(s => s.id);

test('the entity carries the authored weaknesses', () => {
  assert.deepEqual(liveCore().target.weaknesses, registries.enemies.get('wanderingSoldier').weaknesses);
});

test('a blunt hit on a blunt-weak enemy is x1.25 (10 -> 12) with a labelled receipt stage; slashing is not', () => {
  const plain = hit(slashing).receipt, weak = hit(blunt).receipt;
  assert.equal(plain.hpLoss, 10);
  assert.equal(weak.hpLoss, 12);
  const stage = weak.damageReceipt.hits[0].sources.find(s => s.id === 'weakness:blunt');
  assert.equal(stage.label, 'Weak to Blunt');
  assert.equal(stage.multiplier, 1.25);
  assert.deepEqual(weak.weaknesses.map(r => r.to), ['blunt']);
  assert.ok(!stageIds({ receipt: plain }).includes('weakness:blunt'));
});

test('the weakness stage multiplies after Vulnerable: 10 x1.25 x1.25 = 15', () => {
  const r = hit(blunt, { statuses: { vulnerable: { stacks: 1 } } });
  assert.equal(r.receipt.hpLoss, 15);
  const ids = stageIds(r);
  assert.ok(ids.indexOf('vulnerable') >= 0 && ids.indexOf('vulnerable') < ids.indexOf('weakness:blunt'));
});

test('several matching weaknesses multiply: blunt x1.25 and magic x1.5 on a blunt+magic hit', () => {
  const weaknesses = [{ to: 'blunt', effect: 'damage' }, { to: 'magic', effect: 'damage', amount: 50 }, { to: 'fire', effect: 'damage', amount: 100 }];
  const r = hit({ combatProfile: { camp: 'spell', damageType: 'fire', magicShare: 0.5, physicalDamageType: 'blunt' } }, { weaknesses, amount: 16 });
  assert.deepEqual(r.receipt.weaknesses.map(w => w.to).sort(), ['blunt', 'fire', 'magic']);
  assert.equal(r.receipt.hpLoss, Math.floor(16 * 1.25 * 1.5 * 2));
});

test('a spell triggers magic and its element, not a physical type', () => {
  const triggers = hitWeaknessTriggers(liveCore().combat, null, fireSpell);
  assert.deepEqual(triggers.sort(), ['fire', 'magic']);
  const r = hit(fireSpell, { enemyId: 'graveWisp' });
  assert.deepEqual(r.receipt.weaknesses.map(w => w.to).sort(), ['magic']);
  const sacred = hit({ combatProfile: { camp: 'spell', damageType: 'sacred', magicShare: 1 } }, { enemyId: 'graveWisp' });
  assert.deepEqual(sacred.receipt.weaknesses.map(w => w.to).sort(), ['magic', 'sacred']);
  const incoming = x => x.receipt.damageReceipt.hits[0].sources.filter(row => row.id.startsWith('weakness:')).at(-1).effective;
  assert.equal(incoming(r), 12);
  assert.equal(incoming(sacred), 18);
});

// ---- landed-hit effects ----
function land(weaknesses, { hits = 1, chance = () => true, mana = 3 } = {}) {
  const { combat, target } = liveCore();
  target.weaknesses = weaknesses; target.mana = mana; target.hp = target.maxHp = 500;
  combat.rng.chance = chance;
  for (let i = 0; i < hits; i++) {
    primeAccuracyRolls(combat, { die: 20 });
    applyAttackDamage(combat, combat.player, target, 3, [], { ...blunt, skipRatingBonus: true });
  }
  return { combat, target, events: type => combat.eventLog.filter(e => e.type === type) };
}

test('a mana weakness costs the hit enemy Mana (floored at 0) and reports it', () => {
  const r = land([{ to: 'blunt', effect: 'mana', amount: 2 }]);
  assert.equal(r.target.mana, 1);
  assert.deepEqual(r.events('manaLost').map(e => e.amount), [2]);
  assert.equal(r.events('weaknessTriggered')[0].effect, 'mana');
  assert.equal(land([{ to: 'blunt', effect: 'mana', amount: 2 }], { mana: 0 }).events('manaLost').length, 0);
});

test('a stamina weakness queues SP loss for the enemy next turn; a non-matching hit does not', () => {
  assert.equal(land([{ to: 'blunt', effect: 'stamina' }]).target.pendingStaminaLoss, 1);
  assert.equal(land([{ to: 'fire', effect: 'stamina' }]).target.pendingStaminaLoss || 0, 0);
});

test('a stagger weakness rolls its chance, and staggers once per target per round', () => {
  const weak = [{ to: 'blunt', effect: 'stagger', amount: 40 }];
  const rolls = [];
  const r = land(weak, { hits: 2, chance: (stream, pct) => { rolls.push([stream, pct]); return true; } });
  assert.deepEqual(rolls[0], ['combatProcs', 40]);
  assert.equal(r.events('enemyStaggered').filter(e => e.cause === 'weakness').length, 1, 'second hit the same round does not stagger again');
  assert.equal(land(weak, { chance: () => false }).events('enemyStaggered').length, 0);
});

test('the damage event lists the weaknesses it met', () => {
  const r = land([{ to: 'blunt', effect: 'damage' }]);
  const event = r.events('damageDealt')[0];
  assert.deepEqual(event.weaknesses, [{ to: 'blunt', effect: 'damage', amount: 25 }]);
  assert.equal(r.events('weaknessTriggered')[0].to, 'blunt');
});
