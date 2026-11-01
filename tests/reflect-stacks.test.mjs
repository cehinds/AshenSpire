// Reflect stacks (owner 2026-10-31, SPEC §17): `reflectStacks` on the combat entity cuts each incoming hit by
// min(0.9, stacks x 0.3) before Block (rounded down) and sends floor(original x min(0.9, stacks x 0.3)) back at the attacker
// as a flagged hit that cannot reflect or counter again; each reflected hit costs one stack; stacks cap at 10 and clear with the fight.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { applyAttackDamage } from '../src/engine/actions.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { gainReflectStacks, reflectReduceFraction, reflectReturnFraction } from '../src/engine/guardStacks.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';
import { mechanics } from '../src/framework/data/mechanics.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function live(registries = reg) {
  const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  combat.player.basePrecisionBonus = 1000;
  Object.assign(enemy, { hp: 500, maxHp: 500, statuses: {}, ratings: { poise: 20 }, ratingSources: [], attributes: { dexterity: 0 }, basePrecisionBonus: 1000, persistentPoise: { value: 0, max: 0 } });
  Object.assign(combat.player, { block: 0, persistentPoise: { value: 0, max: 0 } });
  return { combat, enemy };
}
function exchange(stacks, setup) {
  const { combat, enemy } = live();
  combat.player.reflectStacks = stacks;
  setup?.(combat, enemy);
  dispatch(combat, { type: 'setReactions', enabled: false });
  const start = combat.eventLog.length;
  const hp = combat.player.hp, enemyHp = enemy.hp;
  dispatch(combat, { type: 'endTurn' });
  const events = combat.eventLog.slice(start);
  return { combat, enemy, events, playerLoss: hp - combat.player.hp, enemyLoss: enemyHp - enemy.hp,
    reflected: events.find(e => e.type === 'reflectTriggered'),
    back: events.find(e => e.type === 'damageDealt' && e.targetId === enemy.id),
    taken: events.find(e => e.type === 'damageDealt' && e.targetId === 'player') };
}

test('fractions are data: 0.3 per stack, capped at 0.9', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 10].map(reflectReduceFraction), [0, 0.3, 0.6, 0.8999999999999999, 0.9, 0.9].map((v, i) => i === 3 ? Math.min(0.9, 3 * 0.3) : v));
  assert.equal(reflectReturnFraction(10), mechanics.reflect.reduceCap);
});

test('reduction: stacks cut the hit before Block, rounded down', () => {
  for (const stacks of [1, 2]) {
    const { reflected, taken } = exchange(stacks);
    assert.equal(taken.amount, Math.floor(reflected.original * (1 - stacks * 0.3)), `${stacks} stack(s)`);
    assert.equal(taken.hpLoss, taken.amount, 'no Block: all of it reaches HP');
  }
});

test('return: the attacker takes floor(original x stacks x 0.3) as a flagged hit; one stack is spent', () => {
  const { reflected, back, combat, events } = exchange(2);
  assert.equal(reflected.amount, Math.floor(reflected.original * 0.6));
  assert.equal(back.damageReceipt.hits[0].incoming, reflected.amount, 'the attacker took exactly the reflected amount before its own protection');
  assert.equal(back.sourceId, 'player');
  assert.equal(reflected.stacks, 2); assert.equal(reflected.stacksLeft, 1);
  assert.equal(combat.player.reflectStacks, 1, 'one stack lost per reflected hit');
  assert.equal(events.filter(e => e.type === 'reflectTriggered').length, 1);
});

test('cap: ten stacks cut and return 90%, not 300%', () => {
  const { reflected, taken, back } = exchange(10);
  assert.equal(taken.amount, Math.floor(reflected.original * 0.1 + 1e-9));
  assert.equal(back.damageReceipt.hits[0].incoming, Math.floor(reflected.original * 0.9));
});

test('no recursion: a reflected hit does not reflect again even into a Reflecting attacker', () => {
  const { events, enemy } = exchange(2, (combat, e) => { e.reflectStacks = 5; });
  assert.equal(events.filter(e => e.type === 'reflectTriggered').length, 1, 'only the first hit reflected');
  assert.equal(enemy.reflectStacks, 5, 'the attacker\'s Reflect was never spent by the return');
});

test('flagged and unreflectable hits are neither cut nor returned', () => {
  const { combat, enemy } = live();
  combat.player.reflectStacks = 3;
  const carrier = (extra = {}, traits = []) => ({ combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing', range: 'melee', targeting: 'single', traits }, ...extra });
  const plain = profileDamageReceipt(combat, enemy, combat.player, 20, carrier());
  assert.ok(plain.reflect, 'a plain hit reflects'); assert.equal(plain.reflect.stacks, 3);
  assert.equal(plain.damageReceipt.hits[0].incoming, Math.floor(plain.reflect.original * (1 - 0.9)));
  for (const [label, row] of [['unreflectable', carrier({}, ['unreflectable'])], ['reflected return', carrier({ reflectedHit: true })], ['counter return', carrier({ counterReturnAttack: true })]]) {
    const receipt = profileDamageReceipt(combat, enemy, combat.player, 20, row);
    assert.equal(receipt.reflect, undefined, label);
    assert.equal(receipt.damageReceipt.hits[0].incoming > plain.damageReceipt.hits[0].incoming, true, `${label} is not cut`);
  }
});

test('Mirror Guard grants 1 Reflect; stacks cap at mechanics.reflect.stackCap', () => {
  const { combat } = live();
  combat.piles.hand.push({ instanceId: 'mg1', cardId: 'core.mirrorGuard', upgraded: false });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'mg1' });
  assert.equal(combat.player.reflectStacks, 1);
  assert.equal(gainReflectStacks(combat, combat.player, 99), mechanics.reflect.stackCap - 1);
  assert.equal(combat.player.reflectStacks, mechanics.reflect.stackCap);
  assert.equal(gainReflectStacks(combat, combat.player, 1), 0);
});

test('snapshots round-trip reflectStacks, load without it, and refuse a count over the cap', () => {
  const { combat, enemy } = live();
  Object.assign(enemy, { ratings: { ar: 0, dr: 0, pr: 0, ward: 0, poise: 20 } });
  combat.player.reflectStacks = 4;
  const snapshot = serializeCombatSnapshot(combat);
  assert.deepEqual(combatSnapshotProblems(snapshot), []);
  const loaded = restoreCombatSnapshot({ registries: reg, rng: createRng(511, combat.rng.getCounters()), snapshot });
  assert.equal(loaded.player.reflectStacks, 4);
  const old = structuredClone(snapshot);
  delete old.player.reflectStacks;
  assert.deepEqual(combatSnapshotProblems(old), [], 'absent means 0');
  old.player.reflectStacks = 25;
  assert.deepEqual(combatSnapshotProblems(old), []);
  assert.equal(restoreCombatSnapshot({ registries: reg, rng: createRng(511, combat.rng.getCounters()), snapshot: old }).player.reflectStacks, mechanics.reflect.stackCap);
});

test('multi-hit previews spend one Reflect stack per landed hit, as live does', async () => {
  const { previewDamageHits } = await import('../src/engine/combatDamagePreview.js');
  const { combat, enemy } = live();
  combat.player.reflectStacks = 1;
  const carrier = { combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing', range: 'melee', targeting: 'single', traits: [] } };
  const view = previewDamageHits(combat, enemy, combat.player, 20, [], carrier, 2);
  const [first, second] = view.damageReceipt.hits.map(hit => hit.incoming);
  assert.equal(first, Math.floor(second * 0.7), 'only the first hit is cut (1 stack = 30%)');
  assert.equal(combat.player.reflectStacks, 1, 'the preview works on a detached copy');
});

test('integer arithmetic: 10 incoming at 4 stacks leaves 1; 30 original at 3 stacks returns 27', async () => {
  const { reflectCut, reflectReturned } = await import('../src/engine/guardStacks.js');
  assert.equal(reflectCut(10, 4), 1); assert.equal(reflectCut(10, 3), 1);
  assert.equal(reflectReturned(30, 3), 27); assert.equal(reflectReturned(30, 10), 27);
  const { combat, enemy } = live();
  combat.player.reflectStacks = 4;
  const carrier = { combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing', range: 'melee', targeting: 'single', traits: [] } };
  const receipt = profileDamageReceipt(combat, enemy, combat.player, 10, carrier);
  assert.equal(receipt.damageReceipt.hits[0].incoming, reflectCut(receipt.reflect.original, 4), 'preview receipt == helper == live path');
});

test('Mirror Guard\'s face states the amount: 1 Reflect, 2 upgraded', async () => {
  const { cardFaceLines } = await import('../src/model/cardFaceText.js');
  const { combat } = live();
  const face = upgraded => { combat.piles.hand.push({ instanceId: `mf${upgraded}`, cardId: 'core.mirrorGuard', upgraded }); const { previewCard } = globalThis.__pv; const view = previewCard(combat, `mf${upgraded}`); return (cardFaceLines(view.resolvedDefinition, view, reg) || []).map(l => l.html).join(' ').replace(/<[^>]+>/g, ''); };
  globalThis.__pv = await import('../src/engine/combat.js');
  assert.match(face(false), /\b1\b.*Reflect|Reflect.*\b1\b/);
  assert.match(face(true), /\b2\b.*Reflect|Reflect.*\b2\b/);
});

test('a lethal hit on the Reflect holder still returns damage and spends the stack', () => {
  const { reflected, back, combat } = exchange(1, (c) => { c.player.hp = 1; });
  assert.equal(combat.player.alive, false, 'the holder died');
  assert.ok(reflected, 'the reflection resolved');
  assert.equal(back.damageReceipt.hits[0].incoming, reflected.amount);
  assert.equal(combat.player.reflectStacks ?? 0, 0, 'the stack was spent');
});

test('a reflected hit keeps the incoming carrier\'s magicShare split (fully magical return is absorbed by Poise)', () => {
  const { combat, enemy } = live();
  combat.player.reflectStacks = 1;
  enemy.persistentPoise = { value: 20, max: 20 };
  const carrier = { magicShare: 1, combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'blunt', range: 'melee', targeting: 'single', traits: [] } };
  const hp = enemy.hp;
  applyAttackDamage(combat, enemy, combat.player, 20, [], carrier);
  const back = combat.eventLog.filter(e => e.type === 'damageDealt' && e.targetId === enemy.id).at(-1);
  assert.ok(back, 'the return landed');
  assert.equal(back.hpLoss, 0, 'all absorbed by the 20 Poise');
  assert.equal(enemy.hp, hp);
});

test('a Reflect return that kills a multi-hit attacker cancels its later hits in previews, as live does', async () => {
  const { previewDamageHits } = await import('../src/engine/combatDamagePreview.js');
  const { projectEnemyIntentDamage } = await import('../src/engine/enemyIntentProjection.js');
  const carrier = { combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing', range: 'melee', targeting: 'single', traits: [] } };
  const prime = () => { const { combat, enemy } = live(); enemy.hp = 1; combat.player.reflectStacks = 1; return { combat, enemy }; };
  const { combat, enemy } = prime();
  const view = previewDamageHits(combat, enemy, combat.player, 5, [], carrier, 3);
  assert.equal(view.hits, 1, 'the first hit\'s return kills the 1-HP attacker; hits 2 and 3 are cancelled');
  assert.equal(view.totalDamage, view.hitDamages[0]);
  assert.equal(enemy.hp, 1, 'the preview never damages the live attacker');
  // Without a Reflect stack all three hits are forecast, so the cut is what cancels them.
  const bare = live();
  bare.enemy.hp = 1;
  assert.equal(previewDamageHits(bare.combat, bare.enemy, bare.combat.player, 5, [], carrier, 3).hits, 3);
  // Enemy-intent projection: the same three-hit move forecasts only the first hit.
  const p = prime();
  const move = { id: 'x', intent: 'attack', damage: 5, hits: 3 };
  p.enemy.intent = { moveId: 'x', kind: 'attack', damage: 5, hits: 3 };
  const projected = projectEnemyIntentDamage(p.combat, p.enemy, { kind: 'attack', damage: 5, damageScope: 'action' }, { base: 5, hits: 3, move, action: null });
  const one = prime();
  const cut = projectEnemyIntentDamage(one.combat, one.enemy, { kind: 'attack', damage: 5, damageScope: 'action' }, { base: 5, hits: 1, move, action: null }).projectedDamage.max;
  const bareProj = projectEnemyIntentDamage(bare.combat, bare.enemy, { kind: 'attack', damage: 5, damageScope: 'action' }, { base: 5, hits: 3, move, action: null });
  assert.ok(bareProj.projectedDamage.max > cut, 'control: without Reflect the three hits exceed one cut hit');
  assert.ok(projected.projectedDamage.max <= cut, `projection max ${projected.projectedDamage.max} counts only the first hit (${cut}), not three`);
});

test('a Reflect return that breaks the attacker\'s Poise ends its matching-stance bonus for later hits, preview == live', async () => {
  const { previewDamageHits } = await import('../src/engine/combatDamagePreview.js');
  const carrier = () => ({ tags: [], combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing', range: 'melee', targeting: 'single', traits: [] } });
  const prime = () => {
    const { combat, enemy } = live();
    combat.player.reflectStacks = 1;
    enemy.persistentPoise = { value: 1, max: 5 };
    enemy.combatStance = { maneuver: 'attack', camp: 'physical', range: 'melee' };
    return { combat, enemy };
  };
  const p = prime();
  const view = previewDamageHits(p.combat, p.enemy, p.combat.player, 20, [], carrier(), 3);
  const l = prime();
  const liveHits = [];
  for (let i = 0; i < 3; i++) {
    const hp = l.combat.player.hp;
    applyAttackDamage(l.combat, l.enemy, l.combat.player, 20, [], carrier());
    liveHits.push(hp - l.combat.player.hp);
  }
  assert.deepEqual(view.hitDamages, liveHits, 'preview hit-by-hit equals live');
  assert.equal(view.totalDamage, liveHits.reduce((a, b) => a + b, 0));
  assert.ok(liveHits[1] < liveHits[0] + 6 && liveHits[1] === liveHits[2], 'later hits are equal once the stance bonus is gone');
});

test('a solo player preview binds its detached attacker, so level-keyed Precision matches the live roll chance, with and without Reflect', async () => {
  const { previewDamageHits } = await import('../src/engine/combatDamagePreview.js');
  const carrier = { combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing', range: 'melee', targeting: 'single', traits: [] } };
  for (const stacks of [0, 2]) {
    const { combat, enemy } = live();
    combat.player.basePrecisionBonus = 0; // the real value, not live()'s auto-hit helper
    Object.assign(enemy, { baseEvasionBonus: 0, reflectStacks: stacks || undefined });
    const liveChance = profileDamageReceipt(combat, combat.player, enemy, 20, carrier).hitChance;
    const view = previewDamageHits(combat, combat.player, enemy, 20, [], carrier, 2);
    assert.equal(liveChance, 0.8, 'control: level-1 Core Reaver vs no bonus Evasion is an 80% hit under the #2436 formula (Evasion 8 + DEX + 2/stack), unclamped so a level-0 preview would differ');
    assert.equal(view.hitChance, liveChance, `${stacks} Reflect stack(s): preview chance == live receipt chance`);
  }
});

test('Counter forecast under Reflect equals live: a return that kills the attacker forecasts no Counter; a survivable one forecasts live\'s damage', async () => {
  const { previewCard } = await import('../src/engine/combat.js');
  const run = enemyHp => {
    const { combat, enemy } = live();
    enemy.hp = enemyHp;
    combat.player.reflectStacks = 1;
    combat.piles.hand.push({ instanceId: 'rcx', cardId: 'core.counter' });
    const forecast = previewCard(combat, 'rcx').counterReturn;
    dispatch(combat, { type: 'playCard', cardInstanceId: 'rcx' });
    dispatch(combat, { type: 'setReactions', enabled: false });
    const start = combat.eventLog.length;
    dispatch(combat, { type: 'endTurn' });
    const events = combat.eventLog.slice(start);
    return { forecast, reflected: events.find(e => e.type === 'reflectTriggered'), counter: events.find(e => e.type === 'combatCounterTriggered') };
  };
  const kill = run(1);
  assert.ok(kill.reflected, 'live: the Reflect return fired');
  assert.equal(kill.counter, undefined, 'live: the dead attacker is never Countered');
  assert.ok(!kill.forecast?.hp, `forecast Counter hp ${kill.forecast?.hp} must be 0/absent when the attacker dies to Reflect`);
  const survive = run(500);
  assert.ok(survive.reflected && survive.counter, 'control: Reflect does not kill, the Counter lands');
  assert.equal(survive.forecast.hp, survive.counter.amount, 'forecast == live Counter damage');
});

// Codex on #2431: per-root reaction policy, a Reflect return that breaks a multi-hit attacker's Poise ends its matching-stance bonus,
// so later hits (and the Counter Block they grant) are priced from the evolving detached attacker, not the original enemy.
test('per-root Counter forecast prices later contacts from the Poise-broken attacker, forecast == live', async () => {
  const { previewCard } = await import('../src/engine/combat.js');
  const bundle = { ...contentBundle, enemies: contentBundle.enemies.map(e => e.id === 'wanderingSoldier' ? { ...e, moves: { ...e.moves, slash: { intent: 'attack', damage: 20, hits: 3, weight: 45 } } } : e) };
  const triple = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(bundle, profile)), profile);
  const run = poise => {
    const { combat, enemy } = live(triple);
    delete combat.reactionRules.contactPolicy;
    combat.player.reflectStacks = 1;
    combat.player.counterStacks = 10;
    if (poise) { enemy.ratings = { poise }; enemy.persistentPoise = { value: poise, max: poise }; }
    enemy.combatStance = { maneuver: 'attack', camp: 'physical', range: 'melee' };
    Object.assign(enemy, { maxStamina: 3, stamina: 3, plannedMoves: [] });
    enemy.intent = { ...enemy.intent, kind: 'attack', moveId: 'slash', damage: 20, hits: 3, combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing', range: 'melee', targeting: 'single', traits: [], stanceTrigger: false } };
    combat.piles.hand.push({ instanceId: 'rcp', cardId: 'core.counter' });
    const forecast = previewCard(combat, 'rcp').counterReturn;
    dispatch(combat, { type: 'playCard', cardInstanceId: 'rcp' });
    dispatch(combat, { type: 'setReactions', enabled: false });
    const start = combat.eventLog.length;
    dispatch(combat, { type: 'endTurn' });
    const all = combat.eventLog.slice(start);
    const counters = all.filter(e => e.type === 'combatCounterTriggered');
    return { forecast, liveHp: counters.reduce((s, e) => s + (e.amount || 0), 0), n: counters.length };
  };
  const broken = run(1);
  assert.equal(broken.n, 1, 'live: one Counter return');
  assert.equal(broken.forecast.hp, broken.liveHp, 'Reflect breaks the attacker\'s Poise: forecast == live return damage');
  const control = run(0);
  assert.equal(control.forecast.hp, control.liveHp, 'control: nothing to break, forecast == live');
  assert.equal(control.forecast.hp, 111, 'control forecast unchanged');
  assert.ok(broken.liveHp < control.liveHp, 'the Poise break really removed the later-hit bonus');
});
