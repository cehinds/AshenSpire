import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { attackHitPreview, resolveAttackHit } from '../src/engine/stanceHit.js';
import { previewTacticalAction, stancePressureMultiplier } from '../src/engine/combatMatchups.js';
const registries = createRegistries(contentBundle);
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
test('retained stacks enable Counter failed-Evade bonus while Smash keeps its stance condition', () => {
  for (const maneuver of ['smash', 'counter']) {
    const f = fixture(maneuver, 'sweep');
    const hit = attackHitPreview(f.ctx, f.source, f.target, f.carrier);
    assert.equal(hit.evadeAttempted, true);
    const factor = maneuver === 'counter' ? 1.5 : 1;
    assert.equal(previewTacticalAction(f.ctx, f.source, f.target, f.carrier, [{ amount: 10 }]).amount, 10 * factor);
    assert.equal(stancePressureMultiplier(f.ctx, f.source, f.target, f.carrier, hit), factor);
  }
});
test('committed prepared-Evade receipt keeps pressure equal after its charge is consumed', () => {
  const f = fixture('counter', 'sweep');
  f.target.statuses = {};
  f.target.combatEvade = { charges: 1, bonus: 3, expiresOnOwnerCycle: 1 };
  const before = previewTacticalAction(f.ctx, f.source, f.target, f.carrier, [{ amount: 10 }]);
  const hit = resolveAttackHit(f.ctx, f.source, f.target, f.carrier);
  assert.equal(hit.evadeAttempted, true);
  assert.equal(f.target.combatEvade.charges, 0);
  assert.equal(before.amount, 15);
  assert.equal(stancePressureMultiplier(f.ctx, f.source, f.target, f.carrier, hit), 1.5);
});
