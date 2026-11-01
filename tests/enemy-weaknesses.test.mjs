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
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { calloutForEvent } from '../src/ui/fx.js';
import { weaknessTraitRows, describeWeakness } from '../src/model/enemyWeaknessRules.js';
import { projectEnemyKnowledge } from '../src/model/enemyKnowledgeView.js';
import { createCombat } from '../src/engine/combat.js';
import { applyStatus } from '../src/engine/statuses.js';
import { applyAttackDamage, executeAction } from '../src/engine/actions.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { proposalContext, applyProposalPlan } from '../src/engine/proposalStatusRuntime.js';
import { proposalRuleEnabled } from '../src/model/proposalStatusRules.js';
import { hitWeaknessTriggers, refillWeaknesses } from '../src/engine/weaknesses.js';
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

// ---- status weaknesses ----
test('burn applied by the player lands with +1 stack on a burn-stacks-weak enemy, not on a self-applied status', () => {
  const { combat, target } = liveCore('lanternMoth');
  assert.ok(target.weaknesses.some(w => w.to === 'burn' && w.effect === 'stacks'));
  applyStatus(combat, target, 'burn', 2, combat.player);
  assert.equal(target.statuses.burn.stacks, 3);
  assert.equal(combat.eventLog.filter(e => e.type === 'weaknessTriggered' && e.effect === 'stacks').length, 1);
  const other = liveCore('wanderingSoldier').target;
  applyStatus(combat, other, 'burn', 2, combat.player);
  assert.equal(other.statuses.burn.stacks, 2, 'an enemy with no burn weakness is unchanged');
  const self = liveCore('lanternMoth');
  applyStatus(self.combat, self.target, 'burn', 2, self.target);
  assert.equal(self.target.statuses.burn.stacks, 2, 'the enemy burning itself is not weakness');
});

test('burn ticks x1.5 on a burn-tick-weak enemy (4 stacks: 6 HP, not 4)', () => {
  for (const [enemyId, expected] of [['huskBrute', 6], ['wanderingSoldier', 4]]) {
    const { combat, target } = liveCore(enemyId);
    target.hp = target.maxHp = 100;
    target.statuses.burn = { stacks: 4 };
    const before = target.hp;
    executeAction(combat, { effect: { op: 'loseHp', target: 'self', amount: { f: 'stacks', status: 'burn', of: 'owner' } }, source: target, owner: target, target });
    assert.equal(before - target.hp, expected, enemyId);
  }
});

test('a bleed burst deals x1.5 to a bleed-tick-weak enemy', () => {
  const { combat, target } = liveCore('stitchedHound');
  target.hp = target.maxHp = 100;
  executeAction(combat, { effect: { op: 'loseHp', target: 'self', amount: 10, cause: 'proc:bleed' }, source: target, owner: target, target });
  assert.equal(100 - target.hp, 15);
});

test('Elemental Weapon works in Core: a weapon hit adds fire damage, and the element triggers a fire weakness', () => {
  const run = (enemyId, imbued) => {
    const { combat, target } = liveCore(enemyId);
    target.hp = target.maxHp = 500;
    if (imbued) combat.player.statuses['base.elemental-weapon'] = { stacks: 2 };
    primeAccuracyRolls(combat, { die: 20 });
    const carrier = { ...blunt, cardTags: ['source:weapon'], skipRatingBonus: true };
    const triggers = hitWeaknessTriggers(combat, combat.player, carrier);
    applyAttackDamage(combat, combat.player, target, 10, [], carrier);
    return { combat, triggers };
  };
  const plain = run('blightHound', false), fire = run('blightHound', true);
  assert.ok(!plain.triggers.includes('fire'));
  assert.ok(fire.triggers.includes('fire') && fire.triggers.includes('magic'), 'the imbued element is a trigger');
  const bonus = fire.combat.queue.filter(a => a.effect?.op === 'damage' && a.card?.damageType === 'fire');
  assert.equal(bonus.length, 1, 'the weapon bonus is queued as a fire hit');
  assert.equal(bonus[0].effect.amount, 3);
  assert.equal(plain.combat.queue.filter(a => a.effect?.op === 'damage').length, 0);
  assert.deepEqual(fire.combat.eventLog.find(e => e.type === 'damageDealt').weaknesses.map(w => w.to).sort(), ['blunt', 'fire']);
});

// ---- snapshots and UI rows ----
test('a combat snapshot round trip keeps the weaknesses', () => {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['huskBrute'] }), target = combat.enemies[0];
  assert.ok(target.weaknesses.length);
  const snapshot = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  const restored = restoreCombatSnapshot({ registries: reg, rng: createRng(511), snapshot, expectedGameProfile: combat.gameProfile });
  assert.deepEqual(restored.enemies[0].weaknesses, target.weaknesses);
});

test('weaknesses read in words: inspector rows, bestiary traits, and the Weak! callout', () => {
  assert.deepEqual(weaknessTraitRows([{ to: 'blunt', effect: 'damage' }, { to: 'burn', effect: 'tick' }, { to: 'lightning', effect: 'stagger' }]), [
    { name: 'Weak to Blunt', detail: '+25% damage' },
    { name: 'Weak to Burn', detail: 'ticks harder' },
    { name: 'Weak to Lightning', detail: 'may stagger' },
  ]);
  assert.equal(describeWeakness({ to: 'burn', effect: 'stacks' }).text, '+1 stack applied');
  const def = registries.enemies.get('wanderingSoldier');
  const view = projectEnemyKnowledge(def, { target: 30, receipts: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`r${i}`, { bonus: 0 }])) }, { registries });
  const names = (view.traits || []).map(row => row.name);
  assert.ok(names.includes('Weak to Blunt'), 'bestiary lists the weakness once the enemy is studied');
  assert.deepEqual(calloutForEvent({ type: 'weaknessTriggered', targetId: 'e1', to: 'blunt', effect: 'damage', amount: 25 }), { kind: 'weak', targetId: 'e1' });
});

test('only Elemental Weapon is live in Core; Greased stays inert in a configured combat', () => {
  const { combat } = liveCore();
  const rules = combat.registries.proposalStatusRules?.rules || combat.registries.proposalStatusRules;
  const caps = proposalContext(combat).capabilities;
  assert.equal(proposalRuleEnabled(rules['base.elemental-weapon'], caps), true);
  assert.equal(proposalRuleEnabled(rules['base.greased'], caps), false);
  assert.equal(proposalRuleEnabled(rules['base.poison'], caps), false);
});

test('the queued Elemental Weapon rider executes as fire, not as the weapon\'s blunt blow', () => {
  const { combat, target } = liveCore('blightHound');
  target.hp = target.maxHp = 500; target.mana = 5;
  target.weaknesses = [{ to: 'blunt', effect: 'damage' }, { to: 'blunt', effect: 'mana' }, { to: 'fire', effect: 'damage' }];
  combat.player.statuses['base.elemental-weapon'] = { stacks: 2 };
  primeAccuracyRolls(combat, { die: 20 });
  applyAttackDamage(combat, combat.player, target, 10, [], { ...blunt, cardTags: ['source:weapon'], skipRatingBonus: true });
  assert.equal(target.mana, 4, 'the blunt swing took 1 Mana');
  const rider = combat.queue.find(a => a.effect?.op === 'damage' && a.card?.damageType === 'fire');
  assert.ok(rider, 'rider queued');
  assert.equal(rider.card.combatProfile.damageType, 'fire');
  assert.equal(rider.card.combatProfile.school, 'fire');
  assert.equal(rider.card.combatProfile.damageComponents, undefined);
  combat.queue.length = 0;
  primeAccuracyRolls(combat, { die: 20 });
  executeAction(combat, rider);
  const event = combat.eventLog.filter(e => e.type === 'damageDealt').at(-1);
  const ids = event.damageReceipt.hits[0].sources.map(s => s.id);
  assert.ok(ids.includes('weakness:fire'), 'fire weakness stage');
  assert.ok(!ids.includes('weakness:blunt'), 'no blunt stage');
  assert.deepEqual(event.weaknesses.map(w => w.to), ['fire']);
  assert.equal(target.mana, 4, 'the rider does not trigger the blunt weakness again');
  assert.deepEqual(hitWeaknessTriggers(combat, combat.player, { damageType: 'fire', combatProfile: { camp: 'physical', damageType: 'blunt' } }).sort(), ['blunt', 'fire']);
});

test('an enemy restored from a snapshot saved before weaknesses takes its definition\'s', () => {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['huskBrute'] });
  const snapshot = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  delete snapshot.enemies[0].weaknesses;
  const restored = restoreCombatSnapshot({ registries: reg, rng: createRng(511), snapshot, expectedGameProfile: combat.gameProfile });
  assert.deepEqual(restored.enemies[0].weaknesses, reg.enemies.get('huskBrute').weaknesses);
});

test('riders keep their own damage type: Auto Counter stays physical, Elemental Weapon fire stays magical', () => {
  const { combat, target } = liveCore('blightHound');
  target.hp = target.maxHp = 500;
  const queue = (damageType) => {
    combat.queue.length = 0;
    applyProposalPlan(combat, { effects: [{ op: 'damage', amount: 6, damageType, camp: 'physical', proposalReactive: true, direct: false, sourceId: combat.player.id, targetId: target.id }] }, combat.player, target, { combatProfile: { camp: 'physical', damageType: 'blunt' } });
    return combat.queue[0];
  };
  const blow = queue('blunt'), fire = queue('fire');
  assert.equal(blow.card.combatProfile.magicShare, undefined);
  assert.equal(blow.card.combatProfile.school, undefined);
  assert.equal(fire.card.combatProfile.magicShare, 1);
  assert.equal(fire.card.combatProfile.school, 'fire');
  combat.queue.length = 0;
  primeAccuracyRolls(combat, { die: 20 });
  executeAction(combat, blow);
  const hit = combat.eventLog.filter(e => e.type === 'damageDealt').at(-1).damageReceipt.hits[0];
  assert.ok(hit.physical > 0 && hit.magical === 0, `physical ${hit.physical}, magical ${hit.magical}`);
});

// ---- Core only ----
test('a legacy (no profile) combat carries no weaknesses: 1 burn stack, x1 ticks, no stage', () => {
  const player = { classId: 'reaver', maxHp: 100, hp: 80, maxMana: 10, maxStamina: 10, stamina: 10, energyMax: 3, drawPerTurn: 3,
    attributes: { strength: 1, dexterity: 1, constitution: 1, wisdom: 1, intelligence: 1 },
    deck: Array.from({ length: 5 }, (_, i) => ({ instanceId: `l${i}`, cardId: 'lastStand', upgraded: false })), relicIds: [] };
  const combat = createCombat({ registries, rng: createRng(1), enemyIds: ['lanternMoth', 'huskBrute'], player });
  const [moth, brute] = combat.enemies;
  assert.equal(moth.weaknesses, undefined);
  applyStatus(combat, moth, 'burn', 1, combat.player);
  assert.equal(moth.statuses.burn.stacks, 1);
  brute.hp = brute.maxHp = 100; brute.statuses.burn = { stacks: 4 };
  executeAction(combat, { effect: { op: 'loseHp', target: 'self', amount: { f: 'stacks', status: 'burn', of: 'owner' } }, source: brute, owner: brute, target: brute });
  assert.equal(100 - brute.hp, 4);
  // Even an enemy forced to carry weaknesses gets nothing outside Core.
  moth.weaknesses = [{ to: 'burn', effect: 'stacks' }]; brute.weaknesses = [{ to: 'burn', effect: 'tick' }];
  moth.statuses = {}; applyStatus(combat, moth, 'burn', 1, combat.player);
  assert.equal(moth.statuses.burn.stacks, 1);
  // The inspector and bestiary read the live enemy's list (undefined outside Core), so a legacy fight shows no Weak-to rows.
  const record = { target: 30, receipts: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`r${i}`, { bonus: 0 }])) };
  const def = registries.enemies.get('lanternMoth');
  assert.ok(!projectEnemyKnowledge(def, record, { registries, weaknesses: undefined }).traits.some(row => row.name.startsWith('Weak to')));
  assert.ok(projectEnemyKnowledge(def, record, { registries }).traits.some(row => row.name.startsWith('Weak to')), 'the bestiary still reads the definition');
});

// ---- restore keeps queued references live ----
// Queued actions and pending reactions point at the restored enemy objects, so the refill must mutate them, never swap in copies.
// (A saved queue needs a real pending choice to pass snapshot validation, so the identity is pinned on the shared helper both restores call.)
test('refillWeaknesses fills enemies in place and keeps the array and the objects', () => {
  const { combat } = liveCore('huskBrute');
  const enemies = [{ id: 'e1', enemyId: 'huskBrute' }, { id: 'e2', enemyId: 'wanderingSoldier', weaknesses: [{ to: 'fire', effect: 'damage' }] }];
  const [first, second] = enemies, queued = { target: first };
  const out = refillWeaknesses(combat, enemies, reg);
  assert.equal(out, enemies);
  assert.equal(out[0], first);
  assert.equal(queued.target, enemies[0]);
  assert.deepEqual(first.weaknesses, reg.enemies.get('huskBrute').weaknesses);
  assert.notEqual(first.weaknesses, reg.enemies.get('huskBrute').weaknesses, 'a clone, not the shared definition');
  assert.deepEqual(second.weaknesses, [{ to: 'fire', effect: 'damage' }], 'an enemy that has weaknesses keeps them');
});
