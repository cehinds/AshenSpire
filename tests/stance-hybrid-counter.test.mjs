import assert from 'node:assert/strict';
import { coreContentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { applyCombatExpansionCard } from '../src/content/combatExpansionCards.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { combatExpansionEntityProblems } from '../src/model/combatTacticsRules.js';
import { stanceOf, stanceEntryBonuses, stanceRatingBonus, sameStance } from '../src/model/stanceRules.js';
import { setCombatStance } from '../src/engine/combatMatchups.js';

const registries = createRegistries(coreContentBundle);
const ctx = { combatExpansionVersion: 2, queue: [], emit() {}, enqueue(action) { this.queue.push(action); } };
const carrierFor = id => {
  const def = applyCombatExpansionCard(resolveCard(registries, { cardId: id }));
  return { ...def, combatProfile: combatProfileFor(def) };
};
for (const id of ['quickstep', 'dodgeRoll', 'evasiveGuard']) {
  const carrier = carrierFor(id), entity = { id, alive: true, statuses: {} };
  assert.equal(carrier.combatProfile.maneuver, 'counter', id + ' uses its real expanded Counter definition');
  assert.ok(carrier.combatProfile.evade, id + ' carries authored Evade');
  assert.deepEqual(stanceEntryBonuses(carrier), { precision: 1, evade: 1, block: 3, barrier: 0 }, id);
  ctx.queue = [];
  setCombatStance(ctx, entity, carrier);
  assert.equal(entity.combatStance.maneuver, 'evade');
  assert.equal(entity.combatStance.counterStance, true);
  assert.equal(stanceRatingBonus(ctx, entity, 'ar'), 1);
  assert.equal(stanceRatingBonus(ctx, entity, 'pr'), 0);
  assert.equal(stanceRatingBonus(ctx, entity, 'dr'), 3);
  assert.equal(ctx.queue.filter(a => a.effect.status === 'precision').length, 1);
  assert.equal(ctx.queue.filter(a => a.effect.status === 'evade').length, 1);
  const entryCount = ctx.queue.length;
  setCombatStance(ctx, entity, carrier);
  assert.equal(ctx.queue.length, entryCount, id + ' repeat does not refresh entry grants');
  assert.equal(stanceRatingBonus(ctx, entity, 'ar'), 1, 'repeat rating does not accumulate');
  // Snapshot JSON retains the resolved Counter identity, independently of a spent reply.
  const loaded = JSON.parse(JSON.stringify(entity));
  assert.deepEqual(stanceOf(loaded.combatStance), entity.combatStance);
  assert.equal(stanceRatingBonus(ctx, loaded, 'ar'), 1);
  assert.deepEqual(combatExpansionEntityProblems(loaded), []);
  const pureEvade = { combatProfile: { camp: 'physical', maneuver: 'defend', evade: { charges: 1 }, range: 'melee' } };
  assert.equal(sameStance(entity, pureEvade), true, 'identity remains maneuver plus camp');
  setCombatStance(ctx, entity, pureEvade);
  assert.equal(ctx.queue.length, entryCount, 'pure Evade metadata refresh grants no extra entry');
  assert.equal(entity.combatStance.counterStance, undefined, 'pure Evade removes Counter provenance');
  assert.equal(stanceRatingBonus(ctx, entity, 'ar'), 0, 'pure Evade cannot inherit Counter offense');
  assert.equal(stanceRatingBonus(ctx, entity, 'dr'), 3);
  assert.equal(stanceEntryBonuses(pureEvade).precision, 0);
}
const magic = { combatProfile: { camp: 'spell', maneuver: 'counter', school: 'frost', range: 'melee', evade: { charges: 1 } } };
const mage = { id: 'mage', alive: true, statuses: {} };
ctx.queue = [];
setCombatStance(ctx, mage, magic);
assert.deepEqual(stanceEntryBonuses(magic), { precision: 1, evade: 1, block: 2, barrier: 1 });
assert.equal(stanceRatingBonus(ctx, mage, 'pr'), 1);
assert.equal(stanceRatingBonus(ctx, mage, 'ar'), 0);
assert.equal(stanceRatingBonus(ctx, mage, 'ward'), 3);
assert.equal(stanceRatingBonus(ctx, mage, 'dr'), 0);
const count = ctx.queue.length;
setCombatStance(ctx, mage, magic);
assert.equal(ctx.queue.length, count);
assert.equal(stanceRatingBonus(ctx, JSON.parse(JSON.stringify(mage)), 'pr'), 1);
assert.ok(combatExpansionEntityProblems({ combatStance: { maneuver: 'evade', camp: 'physical', range: 'melee', counterStance: 'true' } })
  .some(problem => problem.includes('counterStance')));
console.log('hybrid Counter stance assertions passed');
