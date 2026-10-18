import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { attackHitPreview, resolveAttackHit } from '../src/engine/stanceHit.js';
import { beginTacticalAction, previewTacticalAction, stancePressureMultiplier } from '../src/engine/combatMatchups.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { enqueueExpandedAction } from '../src/engine/combatExpansionActions.js';
import { executeAction } from '../src/engine/actions.js';
import { syncWardMaximum, syncPoiseMaximum } from '../src/engine/combatPools.js';
const registries = createRegistries(contentBundle);

for (const die of [1, 20]) test(`retained Evade multi-contact Smash rolls ${die} once for HP, Poise and Ward`, () => {
  const ctx = createCombat({ registries, rng: createRng(881), combatExpansionVersion: 2,
    enemyIds: ['wanderingSoldier'], player: { classId: 'starseer', hp: 100, maxHp: 100,
      mana: 20, maxMana: 20, stamina: 20, maxStamina: 20, energyMax: 20, drawPerTurn: 0, deck: [] } });
  const target = ctx.enemies[0], source = ctx.player;
  target.hp = target.maxHp = 1000; target.block = target.wardBlock = 0; target.evasion = 0;
  target.statuses = { evade: { stacks: 1 } };
  target.combatStance = { camp: 'physical', maneuver: 'sweep', range: 'melee' };
  target.ratings = { ...target.ratings, ward: 50, poise: 1000 };
  target.persistentWard = { value: 50, max: 50 };
  target.poiseMeter = { value: 0, max: 1000 };
  syncWardMaximum(ctx, target); syncPoiseMaximum(ctx, target);
  target.persistentPoise.value = 0;
  const before = { hp: target.hp, poise: target.poiseMeter.value, ward: target.persistentWard.value };
  let draws = 0; ctx.rng.int = stream => { if (stream === 'combatAvoidance') draws++; return die; };
  const carrier = { type: 'attack', tags: ['camp:physical', 'maneuver:smash', 'range:melee', 'damage:slashing'],
    combatProfile: { camp: 'physical', maneuver: 'smash', range: 'melee' } };
  const effects = [{ op: 'damage', amount: 5, hits: 2 }, { op: 'poiseDamage', amount: 4 }, { op: 'wardDamage', amount: 3 }];
  enqueueExpandedAction(ctx, effects.map(effect => ({ effect, source, owner: source, target, card: carrier, meta: {} })),
    { source, target, carrier });
  while (ctx.queue.length) executeAction(ctx, ctx.queue.shift());
  assert.equal(draws, 1, 'all damage and pressure share the one committed check');
  const outcome = ctx.eventLog.filter(event => ['attackHit', 'attackMissed'].includes(event.type));
  assert.equal(outcome.length, 1);
  assert.equal(outcome[0].label, die === 20 ? 'Hit — Evade Failed' : 'Missed');
  assert.equal(before.hp - target.hp, die === 20 ? 15 : 0);
  assert.equal(target.poiseMeter.value - before.poise, die === 20 ? 6 : 0);
  assert.equal(before.ward - target.persistentWard.value, die === 20 ? 4 : 0);
});
function fixture(maneuver, stance = 'evade') {
  const source = { id: 'player', kind: 'player', alive: true, statuses: {} };
  const target = { id: 'enemy', kind: 'enemy', alive: true, statuses: { evade: { stacks: 1 } },
    combatStance: { camp: 'physical', maneuver: stance, range: 'melee' } };
  const ctx = { combatExpansionVersion: 2, registries, player: source, attributes: {},
    rng: { int: () => 20 }, emit() {}, enqueue() {} };
  const carrier = { combatProfile: { camp: 'physical', maneuver, range: 'melee' }, tags: [] };
  return { ctx, source, target, carrier };
}
test('failed Evade matchup HP and pressure require an actual attempt', () => {
  for (const maneuver of ['smash', 'counter']) {
    const f = fixture(maneuver);
    const preview = previewTacticalAction(f.ctx, f.source, f.target, f.carrier, [{ amount: 10 }]);
    assert.equal(preview.amount, 15);
    const hit = resolveAttackHit(f.ctx, f.source, f.target, f.carrier);
    assert.equal(hit.evadeAttempted, true);
    assert.equal(stancePressureMultiplier(f.ctx, f.source, f.target, f.carrier, hit), 1.5);
    const disabled = previewTacticalAction(f.ctx, f.source, f.target, f.carrier, [{ amount: 10 }], { restrictions: { evadeDisabled: true } });
    assert.equal(disabled.amount, 10);
    const disabledHit = resolveAttackHit(f.ctx, f.source, f.target, f.carrier, { evadeDisabled: true });
    assert.equal(stancePressureMultiplier(f.ctx, f.source, f.target, f.carrier, disabledHit), 1);
    f.carrier.combatProfile.camp = 'spell'; f.carrier.tags = ['target'];
    const bypass = resolveAttackHit(f.ctx, f.source, f.target, f.carrier);
    assert.equal(bypass.evadeAttempted, false);
    assert.equal(previewTacticalAction(f.ctx, f.source, f.target, f.carrier, [{ amount: 10 }]).amount, 10);
    assert.equal(stancePressureMultiplier(f.ctx, f.source, f.target, f.carrier, bypass), 1);
  }
});
test('retained stacks enable Smash and Counter failed-Evade bonuses after leaving Evade stance', () => {
  for (const maneuver of ['smash', 'counter']) {
    const f = fixture(maneuver, 'sweep');
    const hit = attackHitPreview(f.ctx, f.source, f.target, f.carrier);
    assert.equal(hit.evadeAttempted, true);
    const factor = 1.5;
    assert.equal(previewTacticalAction(f.ctx, f.source, f.target, f.carrier, [{ amount: 10 }]).amount, 10 * factor);
    assert.equal(stancePressureMultiplier(f.ctx, f.source, f.target, f.carrier, hit), factor);
    const receipt = beginTacticalAction(f.ctx, f.source, f.target, f.carrier, [{ amount: 4 }, { amount: 6 }]);
    assert.equal(receipt.counterAttack.hit, true);
    assert.equal(receipt.counterAttack.evadeAttempted, true);
    assert.equal(receipt.amount, 15, 'all contacts share the failed-Evade multiplier');
    assert.deepEqual(receipt.amounts, [6, 9]);
    assert.equal(stancePressureMultiplier(f.ctx, f.source, f.target, f.carrier, receipt.counterAttack), 1.5);
  }
});
for (const maneuver of ['smash', 'counter']) test(`${maneuver} committed prepared-Evade receipt keeps pressure equal after its charge is consumed`, () => {
  const f = fixture(maneuver, 'sweep');
  f.target.statuses = {};
  f.target.combatEvade = { charges: 1, bonus: 3, expiresOnOwnerCycle: 1 };
  const before = previewTacticalAction(f.ctx, f.source, f.target, f.carrier, [{ amount: 10 }]);
  const hit = resolveAttackHit(f.ctx, f.source, f.target, f.carrier);
  assert.equal(hit.evadeAttempted, true);
  assert.equal(f.target.combatEvade.charges, 0);
  assert.equal(before.amount, 15);
  assert.equal(stancePressureMultiplier(f.ctx, f.source, f.target, f.carrier, hit), 1.5);
});
