import test from 'node:test';
import assert from 'node:assert/strict';
import { abilityChargedEffects, attachAbilityCharges, grantAbilityCharge, matchingAbilityCharges } from '../src/engine/abilityRiders.js';
import { combatExpansionCombos } from '../src/content/combatExpansionCombos.js';

const ctx = { combatExpansionVersion: 2 };
test('v2 charge augments one existing pressure payload and never injects an active stack', () => {
  const effects = [{ op: 'damage', target: 'enemy', amount: 4 }, { op: 'buildup', target: 'enemy', status: 'frost', amount: 3 }];
  const charges = { buildupBonuses: [{ status: 'frost', amount: 2 }] };
  assert.equal(abilityChargedEffects(effects, charges, true, ctx), effects);
  const applied = new Set(), first = { effect: effects[1] }, second = { effect: effects[1] };
  attachAbilityCharges(first, charges, applied, ctx); attachAbilityCharges(second, charges, applied, ctx);
  assert.equal(first.meta.abilityChargeBuildup, 2); assert.equal(second.meta, undefined);
});
test('missing v2 pressure receives an explicit buildup opcode, while legacy fixtures retain applyStatus', () => {
  const effects = [{ op: 'block', target: 'self', amount: 4 }], charges = { buildupBonuses: [{ status: 'bleed', amount: 2 }] };
  const expanded = abilityChargedEffects(effects, charges, true, ctx);
  assert.deepEqual(expanded[1], { op: 'buildup', target: 'enemy', status: 'bleed', amount: 0 });
  assert.deepEqual(abilityChargedEffects(effects, charges)[1], { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 0 });
  assert.equal(abilityChargedEffects(effects, charges, false, ctx), effects);
});
test('v2 insanity charges follow authored Dazed identity and Barrier gets one Block rider', () => {
  const charges = { buildupBonuses: [{ status: 'insanity', amount: 2 }], block: 3 }, applied = new Set();
  const effects = abilityChargedEffects([{ op: 'gainBarrier', target: 'self', amount: 2 }], charges, true, ctx);
  assert.equal(effects[1].status, 'dazed');
  const first = { effect: effects[0] }, pressure = { effect: effects[1] }, repeat = { effect: effects[0] };
  attachAbilityCharges(first, charges, applied, ctx); attachAbilityCharges(pressure, charges, applied, ctx); attachAbilityCharges(repeat, charges, applied, ctx);
  assert.equal(first.meta.abilityChargeBlock, 3); assert.equal(pressure.meta.abilityChargeBuildup, 2); assert.equal(repeat.meta, undefined);
});
test('repeated preparation replaces a bounded charge rather than stacking copies', () => {
  const entity = {};
  grantAbilityCharge(entity, { key: 'combo', damage: 2, cardType: 'attack' });
  grantAbilityCharge(entity, { key: 'combo', damage: 2, cardType: 'attack' });
  assert.equal(matchingAbilityCharges(entity, { type: 'attack' }).damage, 2);
});
test('all eight combination cards carry explicit gates, costs and finite owner-turn budgets', () => {
  assert.equal(combatExpansionCombos.length, 8);
  const byId = new Map(combatExpansionCombos.map(card => [card.id, card]));
  for (const card of combatExpansionCombos) assert.equal(card.minCombatExpansionVersion, 2);
  for (const [id, cost, status] of [['lucidRecovery', 2, 'sleep'], ['groundedResolve', 3, 'paralysis'], ['clearHead', 1, 'dazed']]) {
    const card = byId.get(id); assert.equal(card.cost, cost); assert(card.usableWhile.includes(status));
    assert.equal(card.effects.find(effect => effect.op === 'removeStatus').amount, 1);
  }
  for (const id of ['emberCovenant', 'shatterOpportunity']) assert(byId.get(id).comboHook.oncePerTurn);
  assert.equal(byId.get('lowGuardRiposte').pronePoiseBonus, 2);
  assert.equal(byId.get('crawlingShot').evade.whileStatus, 'prone');
});
