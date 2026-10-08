import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { resolveCombatRatings } from '../src/model/combatRatings.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createCoopCombat } from '../src/engine/coopCombat.js';
import { createRng } from '../src/engine/rng.js';
import { applyRatingImpact } from '../src/engine/combatRatings.js';
import { applyAttackDamage, computeAttackDamage, executeAction } from '../src/engine/actions.js';
import { mountProperties } from '../src/engine/properties.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { advancedConfigSnapshot } from '../src/model/advancedConfig.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { validateContent } from '../src/model/validate.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { breakPropertyText } from '../src/model/breakMeter.js';
import { createSession } from '../tools/session.mjs';
import { initialClassTreeChoices } from '../src/model/classTree.js';
import { registriesForClassMastery } from '../src/model/classMasteryRun.js';

const magic = { damageSchool: 'magic', exposureBuildupPerHit: 5 };
const physical = { damageSchool: 'physical' };
const player = () => ({ classId: 'starseer', hp: 1000, maxHp: 1000, mana: 0, maxMana: 10,
  attributes: { strength: 0, dexterity: 0, constitution: 0, wisdom: 0, intelligence: 0 },
  stamina: 20, maxStamina: 20, energyMax: 20, drawPerTurn: 3, relicIds: [],
  deck: [{ cardId: 'dodgeRoll', instanceId: 'dodge', upgraded: false }] });
function fight({ stamp = 1, ratings = true, enemyIds = ['wanderingSoldier'], tune = null } = {}) {
  const bundle = { ...contentBundle, balance: structuredClone(contentBundle.balance) }; tune?.(bundle);
  const reg = createRegistries(bundle);
  const c = createCombat({ registries: reg, rng: createRng(7), player: player(), enemyIds,
    breakMeterVersion: stamp, ratingsRules: ratings ? resolveCombatRatings({}, bundle) : null });
  c.enemies.forEach(e => { e.hp = e.maxHp = 10000; });
  return c;
}
const events = (c, type) => c.eventLog.filter(e => e.type === type);
function mount(c, tag) { mountProperties(c, { kind: 'armament', id: tag, instanceId: tag, ownerKey: 'player', tagIds: [tag] }); }

test('new fights have one meter; magic keeps Ward damage resistance and folds buildup before guard', () => {
  const c = fight(); const e = c.enemies[0];
  assert.equal(c.player.wardMeter, undefined); assert.equal(e.wardMeter, undefined); assert.equal(e.arcaneExposure, undefined);
  e.poiseGuard = 2; applyAttackDamage(c, c.player, e, 20, [], magic);
  assert.equal(e.poiseGuard, 0); assert.equal(e.poiseMeter.value, 1); // base 1 + floor(5 × .5), guard 2
  assert.equal(events(c, 'arcaneExposureChanged').length, 0);
  e.ratings.ward = 0;
  const unresisted = computeAttackDamage(c, c.player, e, 20, [], magic);
  e.ratings.ward = 100;
  assert.ok(computeAttackDamage(c, c.player, e, 20, [], magic) < unresisted);
});

test('fully Blocked hits cause no impact; explicit Poise damage adds no magical buildup', () => {
  const c = fight(); const e = c.enemies[0]; e.block = 100;
  applyAttackDamage(c, c.player, e, 20, [], magic);
  assert.equal(e.poiseMeter.value, 0); assert.equal(events(c, 'arcaneImpact').length, 0);
  executeAction(c, { source: c.player, owner: c.player, card: magic, effect: { op: 'poiseDamage', target: 'enemy', amount: 2 }, targetId: e.id, meta: {} });
  assert.equal(e.poiseMeter.value, 2); assert.equal(events(c, 'arcaneImpact').length, 0);
});

test('version-1 run construction stamps fights; a persisted older run remains on its own rules', () => {
  const reg = createRegistries(configuredContentBundle(contentBundle, advancedConfigSnapshot()));
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 8, combatExpansionVersion: 1 });
  assert.equal(run.advancedConfigSnapshot.breakMeterVersion, 1);
  const current = createRunCombat({ registries: reg, run, rng: createRng(8), enemyIds: ['wanderingSoldier'] });
  assert.equal(current.breakMeterVersion, 1); assert.equal(current.player.wardMeter, undefined);
  run.advancedConfigSnapshot = structuredClone(run.advancedConfigSnapshot);
  delete run.advancedConfigSnapshot.breakMeterVersion;
  const older = createRunCombat({ registries: reg, run, rng: createRng(8), enemyIds: ['wanderingSoldier'] });
  assert.equal(older.breakMeterVersion, undefined); assert.ok(older.player.wardMeter);
});

test('malformed shared-meter snapshots and balance settings are refused by field', () => {
  const snapshot = serializeCombatSnapshot(fight()); snapshot.enemies = {};
  assert.ok(combatSnapshotProblems(snapshot).some(p => p.includes('enemies')));
  snapshot.enemies = []; snapshot.player.wardGuard = 1;
  assert.ok(combatSnapshotProblems(snapshot).some(p => p.includes('wardGuard')));
  for (const key of ['foldScale', 'staggerBreakImpact']) {
    const b = { ...contentBundle, balance: structuredClone(contentBundle.balance) }; b.balance.exposure[key] = -1;
    assert.ok(validateContent(b).errors.some(e => e.path === `balance.exposure.${key}`));
  }
  const b = { ...contentBundle, balance: structuredClone(contentBundle.balance) }; b.balance.exposure.defaultPayoff.status = 'missing';
  assert.ok(validateContent(b).errors.some(e => e.path.includes('exposure.defaultPayoff')));
});

test('property descriptions follow the stamped run and configured Stagger Break impact', () => {
  const current = createRegistries(configuredContentBundle(contentBundle, advancedConfigSnapshot({ 'gameConfig.balance.exposure.staggerBreakImpact': 4 })));
  assert.equal(breakPropertyText(current, 'staggerBreak'), 'Spell hits gain 4 magical impact.');
  assert.match(breakPropertyText(current, 'staggerBreak', { breakMeterVersion: 0 }), /Arcane Exposure/);
});

test('one magical hit crossing several thresholds emits one arcaneStagger after fills and refunds Siphon once', () => {
  const c = fight(); const e = c.enemies[0]; mount(c, 'siphon');
  e.poiseMeter = { value: 0, max: 2, growths: 0 };
  applyRatingImpact(c, c.player, e, magic, 8);
  assert.equal(events(c, 'meterFilled').length, 2);
  assert.equal(events(c, 'arcaneStagger').length, 1);
  assert.equal(events(c, 'arcaneStagger')[0].threshold, 2);
  assert.ok(c.eventLog.findLastIndex(e => e.type === 'meterFilled') < c.eventLog.findIndex(e => e.type === 'arcaneStagger'));
  assert.equal(e.statuses.magicVulnerable.stacks, 25); assert.equal(e.statuses.magicVulnerable.duration, 2);
  while (c.queue.length) executeAction(c, c.queue.shift());
  assert.equal(c.player.mana, 1);
});

test('physical Stagger, immune enemies and player Stagger do not take the magical payoff', () => {
  const immune = contentBundle.enemies.find(e => e.arcaneExposure?.mode === 'immune').id;
  const c = fight({ enemyIds: ['wanderingSoldier', immune] });
  for (const e of c.enemies) e.poiseMeter.max = 1;
  applyRatingImpact(c, c.player, c.enemies[0], physical, 1);
  assert.equal(c.enemies[0].statuses.magicVulnerable, undefined); assert.equal(events(c, 'arcaneStagger').length, 0);
  applyRatingImpact(c, c.player, c.enemies[1], magic, 1);
  assert.equal(c.enemies[1].statuses.magicVulnerable, undefined);
  c.player.poiseMeter.max = 1; c.ratingsRules.breaks.poiseActionLoss = 2; c.ratingsRules.breaks.wardActionLoss = 7;
  applyRatingImpact(c, c.enemies[0], c.player, magic, 1);
  assert.equal(c.player.pendingActionLoss, 2); assert.equal(c.player.statuses.magicVulnerable, undefined);
});

test('all enemies get the data default payoff and its overrides', () => {
  const id = contentBundle.enemies.find(e => !e.arcaneExposure).id;
  const c = fight({ enemyIds: [id], tune: b => { b.balance.exposure.defaultPayoff.value = 35; b.balance.exposure.defaultPayoff.duration = 3; } });
  const e = c.enemies[0]; e.poiseMeter.max = 1; applyRatingImpact(c, c.player, e, magic, 1);
  assert.equal(e.statuses.magicVulnerable.stacks, 35); assert.equal(e.statuses.magicVulnerable.duration, 3);
});

test('Overcharge is inside the one floor; Stagger Break adds impact; foldScale zero removes only buildup', () => {
  const c = fight(); mount(c, 'overcharge'); applyRatingImpact(c, c.player, c.enemies[0], magic);
  assert.equal(c.enemies[0].poiseMeter.value, 4); // floor(1 + 5 × 1.5 × .5)
  const staff = fight(); mount(staff, 'staggerBreak'); applyRatingImpact(staff, staff.player, staff.enemies[0], magic);
  assert.equal(staff.enemies[0].poiseMeter.value, 5);
  const zero = fight({ tune: b => { b.balance.exposure.foldScale = 0; b.balance.exposure.staggerBreakImpact = 4; } });
  mount(zero, 'staggerBreak'); applyRatingImpact(zero, zero.player, zero.enemies[0], magic);
  assert.equal(zero.enemies[0].poiseMeter.value, 5);
});

test('Resonance uses the pre-growth threshold, spends guard and cannot chain or refund', () => {
  const c = fight({ enemyIds: ['wanderingSoldier', 'wanderingSoldier', 'wanderingSoldier'] });
  mount(c, 'resonance'); mount(c, 'siphon');
  c.enemies[0].poiseMeter.max = 8; c.enemies[1].poiseMeter.max = 2;
  c.enemies[2].poiseMeter.max = 20; c.enemies[2].poiseGuard = 3;
  applyRatingImpact(c, c.player, c.enemies[0], magic, 8);
  while (c.queue.length) executeAction(c, c.queue.shift());
  assert.equal(c.enemies[2].poiseGuard, 0); assert.equal(c.enemies[2].poiseMeter.value, 1);
  assert.equal(c.enemies[1].statuses.magicVulnerable.stacks, 25);
  assert.equal(events(c, 'arcaneStagger').length, 1); assert.equal(c.player.mana, 1);
});

test('Dodge Roll grants one guard and gainWard remains a valid alias', () => {
  const c = fight(); dispatch(c, { type: 'playCard', cardInstanceId: 'dodge' });
  assert.equal(c.player.block, 3); assert.equal(c.player.poiseGuard, 3); assert.equal(c.player.wardGuard, undefined);
  assert.ok(!resolveCard(c.registries, { cardId: 'dodgeRoll', breakMeterVersion: 1 }).effects.some(e => e.op === 'gainWard'));
  executeAction(c, { source: c.player, owner: c.player, effect: { op: 'gainWard', target: 'self', amount: 2 }, meta: {} });
  assert.equal(c.player.poiseGuard, 5); assert.equal(c.player.wardGuard, undefined);
});

test('old and ratings-free fights keep both older meters; old snapshots restore unchanged', () => {
  for (const options of [{ stamp: null }, { ratings: false }]) {
    const c = fight(options); assert.ok(c.enemies[0].arcaneExposure);
    if (c.ratingsRules) {
      assert.ok(c.player.wardMeter); applyRatingImpact(c, c.player, c.enemies[0], magic, 2);
      assert.equal(c.enemies[0].wardMeter.value, 2); assert.equal(c.enemies[0].poiseMeter.value, 0);
    }
    c.enemies[0].hp = c.enemies[0].maxHp = 24;
    const snapshot = serializeCombatSnapshot(c);
    const restored = restoreCombatSnapshot({ registries: c.registries, rng: createRng(7), snapshot });
    assert.deepEqual(serializeCombatSnapshot(restored), snapshot);
  }
  const c = fight(); c.enemies[0].hp = c.enemies[0].maxHp = 24;
  const saved = serializeCombatSnapshot(c); assert.equal(saved.breakMeterVersion, 1);
  assert.equal(saved.player.wardMeter, undefined);
  const restored = restoreCombatSnapshot({ registries: c.registries, rng: createRng(7), snapshot: saved });
  assert.equal(restored.breakMeterVersion, 1); assert.equal(restored.player.wardMeter, undefined);
});

test('new-run snapshots stamp the version and co-op follows the host stamp', () => {
  assert.equal(advancedConfigSnapshot().breakMeterVersion, 1);
  const reg = createRegistries(contentBundle); const ratingsRules = resolveCombatRatings({}, contentBundle);
  for (const stamp of [null, 1]) {
    const c = createCoopCombat({ registries: reg, rng: createRng(7), players: [{ id: 'a', ...player() }], enemyIds: ['wanderingSoldier'], ratingsRules, breakMeterVersion: stamp });
    assert.equal(!!c.enemies[0].wardMeter, stamp !== 1); assert.equal(!!c.enemies[0].arcaneExposure, stamp !== 1);
    assert.equal(!!c.players.get('a').entity.wardMeter, stamp !== 1);
  }
});

test('co-op Stagger triggers refund and draw only for the source, including an inactive seat', () => {
  const reg = createRegistries(contentBundle);
  const players = ['a', 'b'].map(id => ({ id, ...player(), deck: Array.from({ length: 8 }, (_, n) => ({ cardId: 'dodgeRoll', instanceId: `${id}-${n}`, upgraded: false })) }));
  const c = createCoopCombat({ registries: reg, rng: createRng(7), players, enemyIds: ['wanderingSoldier'], ratingsRules: resolveCombatRatings({}, contentBundle), breakMeterVersion: 1 });
  for (const id of ['a', 'b']) for (const tag of ['siphon', 'arcaneDraw']) mountProperties(c, { kind: 'armament', id: tag, instanceId: tag, ownerKey: id, tagIds: [tag] });
  const active = c.player;
  const owner = [...c.players.values()].find(seat => seat.entity !== active).entity; const sourceId = c.playerIdForEntity(owner);
  const otherId = sourceId === 'a' ? 'b' : 'a';
  const before = Object.fromEntries([...c.players].map(([id, seat]) => [id, seat.piles.hand.length]));
  c.enemies[0].poiseMeter.max = 2;
  applyRatingImpact(c, owner, c.enemies[0], magic, 8);
  while (c.queue.length) executeAction(c, c.queue.shift());
  assert.equal(c.players.get(sourceId).entity.mana, 1); assert.equal(c.players.get(otherId).entity.mana, 0);
  assert.equal(c.players.get(sourceId).piles.hand.length, before[sourceId] + contentBundle.balance.classTree.arcaneDraw.draw);
  assert.equal(c.players.get(otherId).piles.hand.length, before[otherId]);
  assert.equal(events(c, 'arcaneStagger').length, 1);
  assert.equal(events(c, 'arcaneStagger')[0].sourcePlayerId, sourceId);
  assert.equal(c.player, active);
});

test('the real co-op session sends Ward ratings and omits retired meters under the host stamp', () => {
  const reg = createRegistries(configuredContentBundle(contentBundle, advancedConfigSnapshot()));
  const host = createSession({ registries: reg, seedString: 'BOSSTIER', combatExpansionVersion: 1 });
  host.addMember({ id: 'p1', name: 'p1', classId: 'reaver' }); host.start();
  assert.equal(host.serialize().advancedConfigSnapshot.breakMeterVersion, 1);
  // Keep this a current-run host fixture, including its required starting pick.
  const run = host.session.members.get('p1').run;
  while (run.classMasteryState?.initialTreeTiers?.length) {
    const choices = initialClassTreeChoices(registriesForClassMastery(reg, run), run);
    assert.ok(choices.length, 'the starting class tier has an eligible choice');
    assert.equal(host.chooseMasteryNode('p1', choices[0]).ok, true);
  }
  const graph = host.session.mapGraph; const node = (graph.bossIds || [graph.bossId])[0];
  host.session.reachableIds = [node]; assert.equal(host.chooseNode('p1', node).ok, true);
  const scene = host.snapshot().scene;
  assert.equal(scene.breakMeterVersion, 1); assert.equal(scene.kind, 'combat');
  for (const enemy of scene.enemies) {
    assert.equal(enemy.ratings.ward, host.live.combat.enemies.find(e => e.id === enemy.id).ratings.ward);
    assert.equal(enemy.wardMeter, undefined); assert.equal(enemy.arcaneExposure, undefined);
  }
  for (const seat of scene.players) { assert.ok(Number.isFinite(seat.ratings.ward)); assert.equal(seat.wardMeter, undefined); }
});
