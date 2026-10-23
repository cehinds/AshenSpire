import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { attackHitPreview, previewCardAttackHit, resolveAttackHit, effectiveEvasion } from '../src/engine/stanceHit.js';
import { contentBundle } from '../src/content/index.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createCombat, dispatch, previewCardHit } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { resolveCombatRatings } from '../src/model/combatRatings.js';
import { enqueueExpandedAction } from '../src/engine/combatExpansionActions.js';
import { syncWardMaximum, syncPoiseMaximum } from '../src/engine/combatPools.js';
import { executeAction } from '../src/engine/actions.js';
import { createRegistries } from '../src/model/registries.js';
const registries = createRegistries(contentBundle);
function fixture(die = 20) {
  const source = { id: 'player', kind: 'player', alive: true, statuses: {}, accuracy: 0 };
  const target = { id: 'enemy', kind: 'enemy', alive: true, statuses: {}, evasion: 0 };
  const events = []; let draws = 0;
  const ctx = { combatExpansionVersion: 2, registries, player: source, attributes: {},
    rng: { int: () => { draws++; return die; } }, emit: (type, event) => events.push({ type, ...event }), enqueue() {} };
  const carrier = { combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' }, tags: [] };
  return { ctx, source, target, carrier, events, draws: () => draws };
}
test('exact d20 preview reads no RNG; natural twenty caps stacked Evasion at 95%', () => {
  const f = fixture(); f.target.statuses.evade = { stacks: 100 };
  assert.equal(effectiveEvasion(f.ctx, f.target), 300);
  assert.equal(attackHitPreview(f.ctx, f.source, f.target, f.carrier).hitChance, 5);
  assert.equal(f.draws(), 0);
  assert.equal(resolveAttackHit(f.ctx, f.source, f.target, f.carrier).hit, true);
  assert.equal(f.target.statuses.evade.stacks, 100);
  assert.equal(f.draws(), 1);
});
test('Target bypasses Evasion only in range and spends no die or Evasion', () => {
  for (const die of [1, 20]) {
    const f = fixture(die); f.target.combatStance = { range: 'ranged' }; f.target.statuses.evade = { stacks: 2 };
    assert.equal(resolveAttackHit(f.ctx, f.source, f.target, f.carrier).missReason, 'range');
    assert.equal(f.target.statuses.evade.stacks, 2); assert.equal(f.draws(), 0);
    f.carrier.combatProfile.camp = 'spell'; f.carrier.tags = ['target']; f.target.combatStance.maneuver = 'evade';
    assert.equal(attackHitPreview(f.ctx, f.source, f.target, f.carrier).hitChance, 0);
    const missed = resolveAttackHit(f.ctx, f.source, f.target, f.carrier);
    assert.equal(missed.hit, false); assert.equal(missed.missReason, 'range');
    assert.equal(f.events.at(-1).label, 'Missed');
    assert.equal(f.target.statuses.evade.stacks, 2); assert.equal(f.draws(), 0);
    f.carrier.combatProfile.range = 'ranged';
    assert.equal(attackHitPreview(f.ctx, f.source, f.target, f.carrier).hitChance, 100);
    assert.equal(resolveAttackHit(f.ctx, f.source, f.target, f.carrier).hit, true);
    assert.equal(f.target.statuses.evade.stacks, 2); assert.equal(f.draws(), 0);
    assert.equal(f.events.at(-1).label, 'Hit');
    f.carrier.tags = ['targeting:single'];
    assert.equal(attackHitPreview(f.ctx, f.source, f.target, f.carrier).bypass, false);
  }
});
test('eligible miss consumes one Evasion and publishes outcome before damage', () => {
  const f = fixture(1); f.target.statuses.evade = { stacks: 2 };
  assert.equal(resolveAttackHit(f.ctx, f.source, f.target, f.carrier).hit, false);
  assert.equal(f.target.statuses.evade.stacks, 1);
  assert.equal(f.events.at(-1).type, 'attackMissed'); assert.equal(f.events.at(-1).label, 'Missed');
});
test('active Evade failures are identified; Sweep precision grows per extra target', () => {
  const f = fixture(); f.target.combatStance = { maneuver: 'evade' }; f.target.statuses.evade = { stacks: 1 };
  resolveAttackHit(f.ctx, f.source, f.target, f.carrier);
  assert.equal(f.events.at(-1).label, 'Hit — Evade Failed');
  f.carrier.combatProfile.maneuver = 'sweep';
  assert.equal(attackHitPreview(f.ctx, f.source, f.target, f.carrier, { additionalTargets: 2 }).accuracy, 1);
});

test('advantage modes enumerate every two-die outcome with any natural twenty automatic', () => {
  for (const mode of ['advantage', 'disadvantage']) {
    const f = fixture(); f.source.accuracyAdvantage = mode === 'advantage'; f.source.accuracyDisadvantage = mode === 'disadvantage';
    f.target.statuses.evade = { stacks: 100 };
    const expected = attackHitPreview(f.ctx, f.source, f.target, f.carrier);
    let hits = 0;
    for (let first = 1; first <= 20; first++) for (let second = 1; second <= 20; second++) {
      let index = 0; f.ctx.rng.int = () => [first, second][index++];
      if (resolveAttackHit(f.ctx, f.source, f.target, f.carrier).hit) hits++;
      f.target.statuses.evade = { stacks: 100 };
    }
    assert.equal(expected.hitChance, 100 * hits / 400);
    assert.equal(expected.hitChance, 9.75);
  }
});

test('one committed miss gates every contact and hostile pressure/status', () => {
  const ctx = createCombat({ registries, rng: createRng(5), combatExpansionVersion: 2,
    ratingsRules: resolveCombatRatings({}, contentBundle), enemyIds: ['wanderingSoldier'],
    player: { classId: 'starseer', maxHp: 100, hp: 100, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1, deck: [] } });
  const target = ctx.enemies[0]; target.evasion = 0; target.statuses = {}; delete target.combatStance;
  target.ratings = { ...target.ratings, ward: 30, poise: 100 };
  target.persistentWard = { max: 30, value: 30 };
  target.persistentPoise = { max: 100, value: 100 };
  syncWardMaximum(ctx, target); syncPoiseMaximum(ctx, target);
  const before = { hp: target.hp, ward: target.persistentWard.value, poise: structuredClone(target.persistentPoise) };
  let draws = 0; ctx.rng.int = stream => { if (stream === 'combatAvoidance') draws++; return 1; };
  const carrier = { type: 'attack', tags: ['camp:physical', 'maneuver:attack', 'range:melee'], combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' } };
  target.statuses.venom = { stacks: 3 };
  const playerHp = ctx.player.hp;
  const effects = [{ op: 'damage', amount: 5, hits: 3 }, { op: 'poiseDamage', amount: 4 }, { op: 'wardDamage', amount: 3 }, { op: 'applyStatus', status: 'weak', stacks: 2 },
    { op: 'removeStatus', target: 'enemy', status: 'venom' }, { op: 'loseHp', target: 'self', amount: 2 }, { op: 'applyStatus', target: 'self', status: 'strength', stacks: 1 }];
  enqueueExpandedAction(ctx, effects.map(effect => ({ effect, source: ctx.player, owner: ctx.player, target, card: carrier, meta: {} })), { source: ctx.player, target, carrier });
  while (ctx.queue.length) executeAction(ctx, ctx.queue.shift());
  assert.equal(draws, 1); assert.equal(target.hp, before.hp); assert.equal(target.persistentWard.value, before.ward);
  assert.deepEqual(target.persistentPoise, before.poise); assert.equal(target.statuses.weak, undefined);
  assert.equal(target.statuses.venom.stacks, 3, 'a miss cannot consume the target status');
  assert.equal(ctx.player.hp, playerHp - 2, 'self costs remain committed');
  assert.equal(ctx.player.statuses.strength.stacks, 1, 'self benefits remain committed');
});
test('Smash pressure planning excludes later oncePerTurn rejection without spending live budget', () => {
  const ctx = createCombat({ registries, rng: createRng(5), combatExpansionVersion: 2,
    ratingsRules: resolveCombatRatings({}, contentBundle), enemyIds: ['wanderingSoldier'],
    player: { classId: 'starseer', maxHp: 100, hp: 100, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1, deck: [] } });
  const target = ctx.enemies[0]; target.evasion = 0; target.statuses = {}; target.combatStance = { maneuver: 'casting', camp: 'spell' };
  target.ratings = { ...target.ratings, ward: 30, poise: 100 };
  target.persistentWard = { max: 30, value: 30 };
  target.persistentPoise = { max: 100, value: 100 };
  syncWardMaximum(ctx, target); syncPoiseMaximum(ctx, target);
  const before = { hp: target.hp, ward: target.persistentWard.value, poise: structuredClone(target.persistentPoise) };
  let draws = 0; ctx.rng.int = stream => { if (stream === 'combatAvoidance') draws++; return 20; };
  const carrier = { type: 'attack', tags: ['camp:physical', 'maneuver:smash', 'range:melee'], combatProfile: { camp: 'physical', maneuver: 'smash', range: 'melee' } };
  const effects = [{ op: 'poiseDamage', amount: 10 }, { op: 'wardDamage', amount: 100, oncePerTurn: 'already-used' }];
  ctx.player.abilityRiders ||= { once: {} }; ctx.player.abilityRiders.once['effect:already-used'] = true;
  const group = enqueueExpandedAction(ctx, effects.map(effect => ({ effect, source: ctx.player, owner: ctx.player, target, card: carrier, meta: {} })), { source: ctx.player, target, carrier });
  assert.equal(Object.values(group.targets)[0].contacts.filter(contact => contact.effect === 'impact').reduce((n, contact) => n + contact.pressure, 0), 10);
  assert.equal(ctx.player.abilityRiders.once['effect:already-used'], true);
  while (ctx.queue.length) executeAction(ctx, ctx.queue.shift());
  assert.equal(draws, 1); assert.equal(target.hp, before.hp); assert.equal(target.persistentWard.value, before.ward - 4);
  assert.equal(target.statuses.weak, undefined);
});

test('Target is authored and compiled for Hex only, without school inference', () => {
  const nodes = readFileSync(new URL('../content/source/nodes.csv', import.meta.url), 'utf8');
  const tagging = readFileSync(new URL('../content/source/tagging.csv', import.meta.url), 'utf8');
  assert.match(nodes, /^target,card,Target,/m);
  const targetRows = tagging.split(/\r?\n/).filter(line => /^card,,[^,]+,target$/.test(line));
  assert.deepEqual(targetRows, ['card,,hex,target']);
  const hex = registries.cards.get('hex');
  assert.ok(hex.tags.includes('target'));
  const f = fixture(1); f.target.statuses.evade = { stacks: 10 };
  f.target.combatStance = { maneuver: 'evade', range: 'reach' };
  const carrier = { ...hex, cardId: 'hex', combatProfile: { camp: 'spell', maneuver: 'casting', range: 'reach' } };
  assert.equal(resolveAttackHit(f.ctx, f.source, f.target, carrier).hit, true);
  assert.equal(f.target.statuses.evade.stacks, 10);
  assert.equal(f.events.at(-1).label, 'Hit');
  assert.equal(f.draws(), 0);
});

test('Spell status bonus follows configured authored payloads for Casting and magic Counter only', () => {
  for (const [maneuver, camp, expected] of [['casting', 'spell', 5], ['counter', 'spell', 5], ['attack', 'spell', 3], ['defend', 'spell', 3], ['counter', 'physical', 3]]) {
    const ctx = createCombat({ registries, rng: createRng(5), combatExpansionVersion: 2,
      ratingsRules: resolveCombatRatings({}, contentBundle), enemyIds: ['wanderingSoldier'],
      player: { classId: 'starseer', maxHp: 100, hp: 100, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1, deck: [] } });
    ctx.stanceRules = { spellStatusStacks: 2 };
    ctx.player.combatStance = { maneuver, camp }; ctx.player.statuses = {};
    const carrier = { type: 'skill', tags: [`camp:${camp}`, `maneuver:${maneuver}`], combatProfile: { camp, maneuver, range: 'reach' } };
    const effects = [{ op: 'applyStatus', target: 'self', status: 'strength', stacks: 3 }, { op: 'applyStatus', target: 'self', status: 'weak', stacks: 0 }];
    enqueueExpandedAction(ctx, effects.map(effect => ({ effect, source: ctx.player, owner: ctx.player, target: ctx.player, card: carrier, meta: {} })), { source: ctx.player, target: ctx.player, carrier });
    while (ctx.queue.length) executeAction(ctx, ctx.queue.shift());
    assert.equal(ctx.player.statuses.strength.stacks, expected, `${camp} ${maneuver}`);
    assert.equal(ctx.player.statuses.weak, undefined, 'a zero authored status does not gain an invented application');
  }
});

test('a hostile status removal without damage still creates exactly one Accuracy decision', () => {
  const ctx = createCombat({ registries, rng: createRng(5), combatExpansionVersion: 2,
    ratingsRules: resolveCombatRatings({}, contentBundle), enemyIds: ['wanderingSoldier'],
    player: { classId: 'starseer', maxHp: 100, hp: 100, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1, deck: [] } });
  const target = ctx.enemies[0]; target.statuses.strength = { stacks: 3 }; delete target.combatStance;
  let draws = 0; ctx.rng.int = stream => { if (stream === 'combatAvoidance') draws++; return 1; };
  const carrier = { type: 'skill', tags: ['camp:spell', 'maneuver:casting'], combatProfile: { camp: 'spell', maneuver: 'casting', range: 'reach' } };
  const group = enqueueExpandedAction(ctx, [{ effect: { op: 'removeStatus', target: 'enemy', status: 'strength' }, source: ctx.player, owner: ctx.player, target, card: carrier, meta: {} }], { source: ctx.player, target, carrier });
  assert.equal(Object.keys(group.targets).length, 1);
  while (ctx.queue.length) executeAction(ctx, ctx.queue.shift());
  assert.equal(draws, 1); assert.equal(target.statuses.strength.stacks, 3);
});

test('Cinder Sigil automatic fire Burn stays four while queued authored Burn gains the Spell bonus', () => {
  for (const [authored, expected] of [[false, 4], [true, 5]]) {
    const ctx = createCombat({ registries, rng: createRng(5), combatExpansionVersion: 2,
      ratingsRules: resolveCombatRatings({}, contentBundle), enemyIds: ['wanderingSoldier'],
      player: { classId: 'starseer', maxHp: 100, hp: 100, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1, deck: [] } });
    const target = ctx.enemies[0]; target.hp = target.maxHp = 500; target.block = target.barrier = 0;
    target.ratings = { ar: 0, dr: 0, pr: 0, poise: 0, ward: 0 }; target.persistentWard = { max: 0, value: 0 }; target.combatTraits = {};
    delete target.combatStance; target.statuses = {};
    ctx.player.combatStance = { maneuver: 'casting', camp: 'spell' };
    ctx.rng.int = () => 20;
    const rules = ctx.combatExpansionRules.statuses;
    ctx.combatStatusRules = { ...rules, statuses: { ...rules.statuses, burn: { ...rules.statuses.burn, initialThreshold: 1000 } } };
    const carrier = { cardId: 'cinderSigil', type: 'attack', tags: ['camp:spell', 'maneuver:casting', 'school:fire', 'damage:fire'],
      damageSchool: 'magic', appliedBuildupStatuses: authored ? ['burn'] : [], combatRiderTargets: [],
      combatProfile: { camp: 'spell', maneuver: 'casting', school: 'fire', damageType: 'fire', range: 'reach' } };
    const effects = [{ op: 'damage', target: 'enemy', amount: 10 }, ...(authored ? [{ op: 'buildup', target: 'enemy', status: 'burn', amount: 4, camp: 'spell' }] : [])];
    enqueueExpandedAction(ctx, effects.map(effect => ({ effect, source: ctx.player, owner: ctx.player, target, card: carrier, meta: {} })), { source: ctx.player, target, carrier });
    while (ctx.queue.length) executeAction(ctx, ctx.queue.shift());
    const burn = ctx.eventLog.filter(event => event.type === 'statusPressure' && event.status === 'burn' && event.targetId === target.id);
    assert.equal(burn.length, 1, 'the automatic rider and printed effect never double apply');
    assert.equal(burn[0].acceptedBuildup, expected, authored ? 'authored Burn gets +1' : 'automatic fire Burn keeps its four-point budget');
  }
});

test('selected-card hit preview includes entry Precision once and matches the played hit', () => {
  const ctx = createCombat({ registries, rng: createRng(5), combatExpansionVersion: 2, reactionRulesVersion: 1,
    ratingsRules: resolveCombatRatings({}, contentBundle), enemyIds: ['wanderingSoldier'],
    player: { classId: 'reaver', maxHp: 100, hp: 100, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1,
      deck: [{ cardId: 'strike', instanceId: 'first', upgraded: false }] } });
  ctx.player.combatStance = { maneuver: 'defend', camp: 'physical', range: 'melee' };
  ctx.player.statuses.precision = { stacks: 2 };
  const target = ctx.enemies[0]; target.hp = target.maxHp = 500; target.evasion = 0; delete target.combatStance;
  for (const [instanceId, expectedPrecision] of [['first', 3], ['second', 3]]) {
    if (instanceId === 'second') ctx.piles.hand.push({ cardId: 'strike', instanceId, upgraded: false });
    primeAccuracyRolls(ctx);
    const before = structuredClone({ source: ctx.player, target, counters: ctx.rng.getCounters() });
    const preview = previewCardHit(ctx, instanceId, target.id);
    assert.deepEqual({ source: ctx.player, target, counters: ctx.rng.getCounters() }, before, 'preview changes no combat state or RNG');
    const out = dispatch(ctx, { type: 'playCard', cardInstanceId: instanceId, targetId: target.id });
    const hit = out.events.find(event => event.type === 'attackHit' && event.targetId === target.id);
    assert.ok(hit, 'the seeded natural twenty lands');
    assert.equal(preview.accuracy, hit.accuracy, instanceId);
    assert.equal(preview.hitChance, hit.hitChance, instanceId);
    assert.equal(ctx.player.statuses.precision.stacks, expectedPrecision, 'same stance does not grant Precision again');
  }
});
test('selected preview never adds entry Precision to an already committed Counter return', () => {
  const f = fixture(); f.source.combatStance = { maneuver: 'defend', camp: 'physical' };
  f.carrier.counterReturnAttack = true; f.carrier.combatProfile.maneuver = 'counter';
  assert.deepEqual(previewCardAttackHit(f.ctx, f.source, f.target, f.carrier), attackHitPreview(f.ctx, f.source, f.target, f.carrier));
  assert.deepEqual(f.source.statuses, {}); assert.equal(f.draws(), 0);
});

test('prepared v2 Evade charges contribute rating and authored bonus and consume once per shared check', () => {
  for (const die of [1, 20]) {
    const f = fixture(die);
    f.target.combatEvade = JSON.parse(JSON.stringify({ charges: 2, bonus: 4, advantage: false, disadvantage: false, expiresOnOwnerCycle: 1 }));
    const before = structuredClone(f.target);
    const preview = attackHitPreview(f.ctx, f.source, f.target, f.carrier);
    assert.equal(preview.evasion, 7, 'one prepared Evade adds three plus its authored four');
    assert.equal(preview.need, 15);
    assert.equal(preview.evadeAttempted, true);
    assert.equal(f.draws(), 0);
    assert.deepEqual(f.target, before, 'inspection never spends preparation');
    const hit = resolveAttackHit(f.ctx, f.source, f.target, f.carrier);
    assert.equal(hit.hit, die === 20);
    assert.equal(hit.evasion, preview.evasion);
    assert.equal(f.target.combatEvade.charges, 1, 'a committed hit or miss spends one charge');
    assert.equal(f.draws(), 1);
  }
});
test('unavailable prepared Evade cannot lend its bonus or roll mode', () => {
  for (const prepared of [
    { charges: 0, bonus: 4, advantage: true },
    { charges: 1, bonus: 4, advantage: true, whileStatus: 'prone' },
    { charges: 1, bonus: 4, advantage: true, expiresOnOwnerCycle: 0 },
  ]) {
    const f = fixture(); f.target.combatEvade = prepared;
    const preview = attackHitPreview(f.ctx, f.source, f.target, f.carrier);
    assert.equal(preview.evasion, 0); assert.equal(preview.mode, 'normal');
    assert.equal(preview.evadeAttempted, false);
    resolveAttackHit(f.ctx, f.source, f.target, f.carrier);
    assert.deepEqual(f.target.combatEvade, prepared);
  }
});
test('Target, range failure and control suppression preserve prepared charges and next-Evade mode', () => {
  for (const reason of ['target', 'range', 'control']) {
    const f = fixture();
    f.target.combatEvade = { charges: 1, bonus: 4, advantage: true };
    f.target.nextEvadeMode = { advantage: true };
    const options = { evadeDisabled: reason === 'control' };
    if (reason === 'target') { f.carrier.combatProfile.camp = 'spell'; f.carrier.tags = ['target']; }
    if (reason === 'range') f.target.combatStance = { range: 'ranged' };
    const hit = resolveAttackHit(f.ctx, f.source, f.target, f.carrier, options);
    assert.equal(hit.evadeAttempted, false);
    assert.equal(f.target.combatEvade.charges, 1);
    assert.ok(f.target.nextEvadeMode);
  }
});
test('expanded dodgeRoll opcode prepares an Evade used by the shared accuracy check', () => {
  const f = fixture();
  executeAction(f.ctx, { effect: { op: 'dodgeRoll', target: 'self' }, source: f.target, owner: f.target, target: f.target,
    card: { combatProfile: { evade: { charges: 1, bonus: 2, advantage: true } } }, meta: {} });
  assert.equal(f.target.combatEvade.charges, 1);
  const hit = resolveAttackHit(f.ctx, f.source, f.target, f.carrier);
  assert.equal(hit.evasion, 5);
  assert.equal(hit.mode, 'disadvantage');
  assert.equal(f.target.combatEvade.charges, 0);
  assert.equal(f.draws(), 2);
  assert.equal(attackHitPreview(f.ctx, f.source, f.target, f.carrier).mode, 'normal');
});

test('restoring a valid v2 snapshot retains a usable prepared Evade', () => {
  const ctx = createCombat({ registries, rng: createRng(5), combatExpansionVersion: 2,
    ratingsRules: resolveCombatRatings({}, contentBundle), enemyIds: ['wanderingSoldier'],
    player: { classId: 'reaver', maxHp: 100, hp: 100, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10,
      energyMax: 10, drawPerTurn: 1, deck: [] } });
  const enemy = ctx.enemies[0];
  enemy.evasion = 0; enemy.statuses = {};
  enemy.combatEvade = { charges: 1, bonus: 4, advantage: true, disadvantage: false, expiresOnOwnerCycle: (enemy.combatOwnerCycle || 0) + 1 };
  const snapshot = serializeCombatSnapshot(ctx);
  const loaded = restoreCombatSnapshot({ registries, rng: createRng(5, ctx.rng.getCounters()), snapshot });
  const target = loaded.enemies[0];
  const carrier = { combatProfile: { camp: 'physical', maneuver: 'attack', range: 'ranged' } };
  const preview = attackHitPreview(loaded, loaded.player, target, carrier);
  assert.equal(preview.evasion, 7);
  assert.equal(preview.evadeAttempted, true);
  assert.equal(preview.mode, 'disadvantage');
  loaded.rng.int = () => 20;
  assert.equal(resolveAttackHit(loaded, loaded.player, target, carrier).hit, true);
  assert.equal(target.combatEvade.charges, 0);
});
