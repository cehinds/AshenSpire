import test from 'node:test';
import assert from 'node:assert/strict';
import { attackHitPreview, resolveAttackHit, effectiveEvasion } from '../src/engine/stanceHit.js';
import { contentBundle } from '../src/content/index.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { resolveCombatRatings } from '../src/model/combatRatings.js';
import { enqueueExpandedAction } from '../src/engine/combatExpansionActions.js';
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
test('range miss and explicit Target spell bypass spend no die or Evasion', () => {
  const f = fixture(1); f.target.combatStance = { range: 'ranged' }; f.target.statuses.evade = { stacks: 2 };
  assert.equal(resolveAttackHit(f.ctx, f.source, f.target, f.carrier).missReason, 'range');
  assert.equal(f.target.statuses.evade.stacks, 2); assert.equal(f.draws(), 0);
  f.carrier.combatProfile.camp = 'spell'; f.carrier.tags = ['target'];
  assert.equal(resolveAttackHit(f.ctx, f.source, f.target, f.carrier).hit, true);
  assert.equal(f.target.statuses.evade.stacks, 2); assert.equal(f.draws(), 0);
  f.carrier.tags = ['targeting:single'];
  assert.equal(attackHitPreview(f.ctx, f.source, f.target, f.carrier).bypass, false);
});
test('eligible miss consumes one Evasion and publishes outcome before damage', () => {
  const f = fixture(1); f.target.statuses.evade = { stacks: 2 };
  assert.equal(resolveAttackHit(f.ctx, f.source, f.target, f.carrier).hit, false);
  assert.equal(f.target.statuses.evade.stacks, 1);
  assert.equal(f.events.at(-1).type, 'attackMissed'); assert.equal(f.events.at(-1).label, 'Missed');
});
test('active Evade failures are identified; Sweep precision grows per extra target', () => {
  const f = fixture(); f.target.combatStance = { maneuver: 'evade' };
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
  target.persistentWard = { max: 30, value: 30 };
  const before = { hp: target.hp, ward: target.persistentWard.value, poise: structuredClone(target.persistentPoise) };
  let draws = 0; ctx.rng.int = stream => { if (stream === 'combatAvoidance') draws++; return 1; };
  const carrier = { type: 'attack', tags: ['camp:physical', 'maneuver:attack', 'range:melee'], combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' } };
  const effects = [{ op: 'damage', amount: 5, hits: 3 }, { op: 'poiseDamage', amount: 4 }, { op: 'wardDamage', amount: 3 }, { op: 'applyStatus', status: 'weak', stacks: 2 }];
  enqueueExpandedAction(ctx, effects.map(effect => ({ effect, source: ctx.player, owner: ctx.player, target, card: carrier, meta: {} })), { source: ctx.player, target, carrier });
  while (ctx.queue.length) executeAction(ctx, ctx.queue.shift());
  assert.equal(draws, 1); assert.equal(target.hp, before.hp); assert.equal(target.persistentWard.value, before.ward);
  assert.deepEqual(target.persistentPoise, before.poise); assert.equal(target.statuses.weak, undefined);
});
