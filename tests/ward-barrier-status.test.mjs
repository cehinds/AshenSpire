// Owner, 2026-11-01 (SPEC 4.1a): Ward and Barrier are stacked statuses.
// Ward: (legacy routing, a fight saved without `ward.routing`) all damage meets Poise first, then Block, then HP; one stack decays at the holder's turn start.
// Owner, 2026-11-15 (W25-W): `ward.routing: "blockFirst"` (shipped) makes a warded hit meet Block first, then Poise absorbs the whole rest 1:1, then HP.
// Barrier: each stack is +5 maximum and current Poise; one stack decays per turn, taking its +5 maximum with it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import * as S from '../src/engine/statuses.js';
import * as A from '../src/engine/actions.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { effects: { physicalDamageMultiplier: 1, playerDamageMultiplier: 1, enemyDamageMultiplier: 1, blockGainMultiplier: 1 } } });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function liveCore({ wardMode = 'blockFirst' } = {}) {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  delete combat.player.combatStance;
  // The targets here hold no stance (Idle); this suite isolates the Poise/Block order from the Idle stance weakness (theme B, 2026-11-17).
  delete combat.fixCoreRules.stanceBenefits?.neutral?.damageTakenMultiplier;
  if (wardMode === 'blockFirst') {
    combat.fixCoreRules = { ...combat.fixCoreRules, ward: { enabled: false, poisePerStack: 5, routing: 'blockFirst', decayPerTurn: 1, breaksAtZeroPoise: true } };
  } else if (wardMode === 'legacy') {
    combat.fixCoreRules = { ...combat.fixCoreRules, ward: { enabled: false, poisePerStack: 5, decayPerTurn: 1 } };
  }
  return combat;
}
// `legacy`: a fight saved before the 2026-11-15 ruling, whose rules carry no `ward.routing` (the Poise-first Ward routing).
// Amount 20: Core halves card base damage (ceil, effects.baseDamageMultiplier 0.5), so every hit below meets the layers as 10.
function hit(carrier, { block = 0, poise = 0, ward = 1, amount = 20, legacy = false, wardMode = legacy ? 'legacy' : 'blockFirst' } = {}) {
  const combat = liveCore({ wardMode }), target = combat.enemies[0];
  Object.assign(target, { block, persistentWard: null, persistentPoise: { value: poise, max: Math.max(20, poise) }, gameProfilePoise: 0, statuses: ward ? { ward: { stacks: ward } } : {} });
  if (wardMode === 'hpBuffer' && ward > 0) target.wardHp = ward * 5;
  delete target.combatStance;
  delete target.weaknesses;
  const receipt = profileDamageReceipt(combat, combat.player, target, amount, { ...carrier, skipRatingBonus: true }, { roll: 0 });
  return { receipt, combat, target, poiseAfter: poise - receipt.poiseMitigated, blockAfter: receipt.blockRemaining };
}
const physical = { combatProfile: { camp: 'physical', damageType: 'slashing' } };
// Arcane carries no element rule, so these cases pin the plain Ward lane. Fire's own Poise rule (it ignores Poise points) has its case below.
const spell = { combatProfile: { camp: 'spell', damageType: 'arcane', magicShare: 1 } };
const fireSpell = { combatProfile: { camp: 'spell', damageType: 'fire', magicShare: 1 } };

for (const [name, carrier] of [['physical', physical], ['magic', spell]]) {
  test(`Ward (legacy routing): a ${name} hit meets Poise first, 100%, before Block`, () => {
    const r = hit(carrier, { poise: 20, block: 5, legacy: true });
    assert.equal(r.receipt.wardRouted, true);
    assert.notEqual(r.receipt.wardBlockFirst, true);
    assert.equal(r.poiseAfter, 10, 'all 10 went to Poise');
    assert.equal(r.blockAfter, 5, 'Block is untouched');
    assert.equal(r.receipt.hpLoss, 0);
    const ids = r.receipt.damageReceipt.hits[0].sources.map(s => s.id);
    assert.ok(ids.includes('ward-poise'), 'the receipt shows where the damage went');
  });
  test(`Ward (legacy routing): ${name} overflow past Poise spills to Block, then HP`, () => {
    const r = hit(carrier, { poise: 4, block: 3, legacy: true });
    assert.equal(r.poiseAfter, 0);
    assert.equal(r.receipt.blocked, 3);
    assert.equal(r.blockAfter, 0);
    assert.equal(r.receipt.hpLoss, 3, '10 - 4 Poise - 3 Block');
    assert.equal(r.receipt.amount, 6, 'HP lost 3 + Block 3 (Poise is reported apart)');
  });
  test(`Ward (block first): a ${name} hit meets Block first, then Poise takes the whole rest`, () => {
    const r = hit(carrier, { poise: 20, block: 5 });
    assert.equal(r.receipt.wardRouted, true);
    assert.equal(r.receipt.wardBlockFirst, true);
    assert.equal(r.receipt.blocked, 5, 'Block soaks first');
    assert.equal(r.blockAfter, 0);
    assert.equal(r.poiseAfter, 15, 'the remaining 5 went to Poise, 1:1');
    assert.equal(r.receipt.hpLoss, 0);
    const ids = r.receipt.damageReceipt.hits[0].sources.map(s => s.id);
    assert.ok(ids.indexOf('block') < ids.indexOf('ward-poise'), 'the receipt shows Block before Poise');
  });
  test(`Ward (block first): ${name} Poise emptied mid-hit, the rest reaches HP`, () => {
    const r = hit(carrier, { poise: 4, block: 3 });
    assert.equal(r.receipt.blocked, 3);
    assert.equal(r.poiseAfter, 0, 'Poise took 4 and is empty');
    assert.equal(r.receipt.hpLoss, 3, '10 - 3 Block - 4 Poise');
  });
  test(`Ward (block first): a ${name} hit with no Block meets Poise 1:1 with no leak`, () => {
    const r = hit(carrier, { poise: 20, block: 0 });
    assert.equal(r.poiseAfter, 10);
    assert.equal(r.receipt.hpLoss, 0);
  });
  test(`Ward off: the ${name} hit does not take the Ward lane`, () => {
    assert.notEqual(hit(carrier, { poise: 20, block: 5, ward: 0 }).receipt.wardRouted, true);
  });
}

test('Ward (block first): Poise emptied mid-hit reports a Poise break when the hit lands', () => {
  const combat = liveCore(), target = combat.enemies[0];
  Object.assign(target, { block: 2, persistentWard: null, persistentPoise: { value: 4, max: 20 }, gameProfilePoise: 0, statuses: { ward: { stacks: 1 } } });
  delete target.combatStance; delete target.weaknesses;
  target.hp = target.maxHp = 100;
  const start = combat.eventLog.length;
  // 20 halves to 10 (Core base-damage scale), as in hit() above.
  A.applyAttackDamage(combat, combat.player, target, 20, [], { ...physical, skipRatingBonus: true });
  assert.equal(target.persistentPoise.value, 0, 'Poise is empty');
  assert.ok(combat.eventLog.slice(start).some(e => e.type === 'poiseBroken' && e.targetId === target.id), 'a Poise break is reported');
  assert.equal(100 - target.hp, 4, '10 - 2 Block - 4 Poise');
});

test('Ward: a fire spell still takes the Ward lane, and the Poise Fire ignores leaves the pool on top of what absorbed the hit', () => {
  const r = hit(fireSpell, { poise: 4, block: 3, legacy: true });
  assert.equal(r.receipt.wardRouted, true);
  assert.ok(r.receipt.element.poiseIgnored > 0, 'Fire ignores some Poise');
  assert.equal(r.poiseAfter, r.receipt.element.poiseIgnored, 'the ignored points are the only Poise left in this helper\'s sum');
});

test('Ward (block first): with no Poise the whole hit meets Block then HP', () => {
  const r = hit(physical, { poise: 0, block: 4 });
  assert.equal(r.receipt.hpLoss, 6);
  assert.equal(r.receipt.blocked, 4);
});

test('Ward decays by 1 at the start of its holder\'s turn, on the shared status hook', () => {
  const combat = liveCore(), e = combat.enemies[0];
  S.applyStatus(combat, e, 'ward', 3, combat.player);
  assert.equal(S.getStacks(e, 'ward'), 3);
  S.decayAtTurnStart(combat, e);
  assert.equal(S.getStacks(e, 'ward'), 2);
  e.fixCoreDecayRound = null; combat.turn += 1;
  S.decayAtTurnStart(combat, e); S.decayAtTurnStart(combat, e);
  assert.equal(S.getStacks(e, 'ward'), 1, 'one decay per holder turn');
});

test('Barrier: each stack is +5 maximum and +5 current Poise', () => {
  const combat = liveCore(), e = combat.enemies[0];
  const { max, value } = e.persistentPoise;
  S.applyStatus(combat, e, 'barrier', 2, combat.player);
  assert.equal(e.persistentPoise.max, max + 10);
  assert.equal(e.persistentPoise.value, value + 10);
});

test('Barrier: a stack lost takes its +5 maximum and current Poise clamps to the new maximum', () => {
  const combat = liveCore(), e = combat.enemies[0];
  const { max } = e.persistentPoise;
  S.applyStatus(combat, e, 'barrier', 2, combat.player);
  S.decayAtTurnStart(combat, e);
  assert.equal(S.getStacks(e, 'barrier'), 1);
  assert.equal(e.persistentPoise.max, max + 5);
  assert.equal(e.persistentPoise.value, max + 5, 'full Poise clamps down with the maximum');
  e.fixCoreDecayRound = null; combat.turn += 1;
  S.decayAtTurnStart(combat, e);
  assert.equal(S.getStacks(e, 'barrier'), 0);
  assert.equal(e.persistentPoise.max, max);
  assert.equal(e.persistentPoise.value, max);
  assert.equal(e.persistentPoise.barrierBonus, undefined);
});

test('Barrier keeps damaged Poise below the maximum when a stack decays', () => {
  const combat = liveCore(), e = combat.enemies[0];
  const { max } = e.persistentPoise;
  S.applyStatus(combat, e, 'barrier', 1, combat.player);
  e.persistentPoise.value = 3;
  S.decayAtTurnStart(combat, e);
  assert.equal(e.persistentPoise.max, max);
  assert.equal(e.persistentPoise.value, 3);
});

test('Mote Shield gains Block, Poise (Barrier stacks) and Ward, and says so', () => {
  const def = reg.cards.get('core.moteShield');
  const ops = def.effects.map(e => `${e.op}:${e.status || ''}:${e.amount ?? e.stacks ?? ''}`);
  assert.ok(ops.includes('applyStatus:barrier:1'), ops.join());
  assert.ok(ops.some(o => o.startsWith('applyStatus:ward:')), ops.join());
  assert.match(def.textTemplate, /\{barrier\} Poise/); assert.doesNotMatch(def.textTemplate, /Barrier/); assert.match(def.textTemplate, /Ward/);
  const up = def.upgrade.effects.map(e => `${e.op}:${e.status || ''}:${e.amount ?? e.stacks ?? ''}`);
  assert.ok(up.includes('applyStatus:barrier:2')); assert.ok(up.includes('applyStatus:ward:2'), up.join());
});

test('the roll log shows where a legacy-routed warded hit went: Poise first, then Block, then HP', async () => {
  const { combatLogEntries } = await import('../src/model/combatLog.js');
  const enemies = [{ id: 'e1', enemyId: 'graveWisp' }];
  const [line] = combatLogEntries([{ type: 'damageDealt', sourceId: 'e1', targetId: 'player', amount: 6, blocked: 3, blockRemaining: 0,
    poiseAbsorbed: 4, poiseRemaining: 0, wardRouted: true }], { enemies }).map(row => row.text);
  assert.match(line, /Ward: Poise absorbed 4 \(4 → 0\), Block absorbed 3 \(3 → 0\)/);
  assert.match(line, /3 HP dealt\.$/);
});

test('the roll log shows a block-first warded hit: Block first, then Ward Poise, then HP', async () => {
  const { combatLogEntries } = await import('../src/model/combatLog.js');
  const enemies = [{ id: 'e1', enemyId: 'graveWisp' }];
  const [line] = combatLogEntries([{ type: 'damageDealt', sourceId: 'e1', targetId: 'player', amount: 6, blocked: 3, blockRemaining: 0,
    poiseAbsorbed: 4, poiseRemaining: 0, wardRouted: true, wardBlockFirst: true }], { enemies }).map(row => row.text);
  assert.match(line, /Block absorbed 3 \(3 → 0\).*Ward: Poise absorbed 4 \(4 → 0\)/);
});

test('a live warded hit under legacy routing reports wardRouted, Poise, Block and HP on damageDealt', () => {
  const combat = liveCore(), target = combat.enemies[0];
  { const { routing, ...wardRules } = combat.fixCoreRules.ward; combat.fixCoreRules = { ...combat.fixCoreRules, ward: wardRules }; }
  Object.assign(target, { block: 3, persistentWard: null, persistentPoise: { value: 4, max: 20 }, gameProfilePoise: 0, statuses: { ward: { stacks: 1 } } });
  delete target.combatStance; delete target.weaknesses;
  target.hp = target.maxHp = 100;
  const start = combat.eventLog.length;
  // 20 halves to 10 (Core base-damage scale), as in hit() above.
  A.applyAttackDamage(combat, combat.player, target, 20, [], { ...physical, skipRatingBonus: true });
  const hit = combat.eventLog.slice(start).find(e => e.type === 'damageDealt' && e.targetId === target.id);
  assert.ok(hit, 'a damageDealt event');
  assert.equal(hit.wardRouted, true);
  assert.equal(hit.poiseAbsorbed, 4);
  assert.equal(hit.blocked, 3);
  assert.equal(100 - target.hp, 3, 'the rest reaches HP');
});

test('old saves: a combat snapshot holding the numeric barrier loads and drops it', async () => {
  const { serializeCombatSnapshot, restoreCombatSnapshot } = await import('../src/engine/combatSnapshot.js');
  const combat = liveCore();
  combat.player.barrier = 7; combat.enemies[0].barrier = 3;
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  const restored = restoreCombatSnapshot({ registries: reg, rng: createRng(combat.rng.seed, combat.rng.getCounters()), snapshot: saved });
  assert.equal('barrier' in restored.player, false, 'the old pool is dropped');
  assert.equal('barrier' in restored.enemies[0], false);
  assert.equal(restored.player.hp, combat.player.hp);
});

test('Barrier on an emptied Poise pool clears the empty marker, so the fight still saves (review #2476)', async () => {
  const { serializeCombatSnapshot } = await import('../src/engine/combatSnapshot.js');
  const combat = liveCore(), e = combat.enemies[0];
  e.persistentPoise = { ...e.persistentPoise, value: 0, missing: e.persistentPoise.max };
  S.applyStatus(combat, e, 'barrier', 1, combat.player);
  assert.equal(e.persistentPoise.value, 5);
  assert.equal('missing' in e.persistentPoise, false, 'a refilled pool is no longer empty');
  assert.doesNotThrow(() => serializeCombatSnapshot(combat));
});

test('Ward (block first): the quote equals the hit that lands (shown = dealt)', () => {
  const carrier = { ...physical, skipRatingBonus: true };
  const quote = hit(physical, { poise: 4, block: 3 }).receipt;
  const combat = liveCore(), target = combat.enemies[0];
  Object.assign(target, { block: 3, persistentWard: null, persistentPoise: { value: 4, max: 20 }, gameProfilePoise: 0, statuses: { ward: { stacks: 1 } } });
  delete target.combatStance; delete target.weaknesses;
  target.hp = target.maxHp = 100;
  const start = combat.eventLog.length;
  // 20 halves to 10 (Core base-damage scale), as in hit() above.
  A.applyAttackDamage(combat, combat.player, target, 20, [], carrier);
  const dealt = combat.eventLog.slice(start).find(e => e.type === 'damageDealt' && e.targetId === target.id);
  assert.equal(dealt.wardBlockFirst, true);
  assert.equal(dealt.blocked, quote.blocked, 'Block');
  assert.equal(dealt.poiseAbsorbed, quote.poiseMitigated, 'Poise');
  assert.equal(100 - target.hp, quote.hpLoss, 'HP');
});

test('Ward (hpBuffer): live combat order Block > Ward > Poise + Health, log order, snapshot round-trip, and shown = dealt', async () => {
  const { combatLogEntries } = await import('../src/model/combatLog.js');
  const { serializeCombatSnapshot, restoreCombatSnapshot } = await import('../src/engine/combatSnapshot.js');
  const combat = liveCore({ wardMode: 'hpBuffer' }), target = combat.enemies[0];
  Object.assign(target, { block: 3, persistentWard: null, gameProfilePoise: 0 });
  target.hp = target.maxHp = 100;
  target.combatStance = { maneuver: 'counter', camp: 'physical' };
  delete target.weaknesses;
  S.applyStatus(combat, target, 'ward', 1, combat.player); // 5 Ward HP
  assert.equal(target.wardHp, 5);
  target.persistentPoise = { value: 6, max: 6 };
  const quote = profileDamageReceipt(combat, combat.player, target, 30, { ...physical, skipRatingBonus: true }, { roll: 0 }); // 15 incoming: 3 Block, 5 Ward, 7 overflow
  const start = combat.eventLog.length;
  A.applyAttackDamage(combat, combat.player, target, 30, [], { ...physical, skipRatingBonus: true });
  const dealt = combat.eventLog.slice(start).find(e => e.type === 'damageDealt' && e.targetId === target.id);
  assert.equal(dealt.wardHpBuffer, true);
  assert.equal(dealt.blocked, quote.blocked);
  assert.equal(dealt.wardAbsorbed, quote.wardHpAbsorbed);
  assert.equal(dealt.poiseAbsorbed, quote.poiseMitigated);
  assert.equal(dealt.poiseAbsorbed, 3, 'Counter stance mitigates the Ward overflow');
  assert.equal(100 - target.hp, quote.hpLoss);
  assert.equal(target.wardHp, undefined);
  assert.equal(target.statuses.ward, undefined);
  assert.ok(combat.eventLog.slice(start).some(e => e.type === 'wardBroken' && e.targetId === target.id));
  const [line] = combatLogEntries([dealt], { enemies: [{ id: target.id, enemyId: target.enemyId }] }).map(row => row.text);
  assert.match(line, /Block absorbed 3.*Ward absorbed 5 \(5 → 0\).*Poise absorbed/);

  // Snapshot round-trip preserves partial wardHp.
  const snapCombat = liveCore({ wardMode: 'hpBuffer' });
  S.applyStatus(snapCombat, snapCombat.player, 'ward', 2, snapCombat.player);
  snapCombat.player.wardHp = 7;
  snapCombat.player.statuses.ward.stacks = 2;
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(snapCombat)));
  const restored = restoreCombatSnapshot({ registries: reg, rng: createRng(snapCombat.rng.seed, snapCombat.rng.getCounters()), snapshot: saved });
  assert.equal(restored.player.wardHp, 7);
});
