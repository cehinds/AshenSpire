import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { loadAuditRuntime } from './runtime.mjs';
import { auditInventory } from './inventory.mjs';
import { makeAuditCombat, settleAuditChoices, setAuditHand } from './fixtures.mjs';

// Independent authored-op contracts. Conditional/triggered operations are reported
// uncovered until a fixture establishes their predicates; preview is not the oracle.
const immediateEvents = { damage: 'damageDealt', block: 'blockGained', heal: 'healed' };
export function assertImmediateContracts(def, events, instanceId) {
  const covered = [], uncovered = [];
  const preparesCounter = (def.cardTags || def.tags || []).includes('maneuver:counter');
  if (preparesCounter) {
    assert.ok(events.some(e => e.type === 'combatCounterArmed' && e.cardInstanceId === instanceId), `${def.id}: counter payload must arm`);
    covered.push('counter-preparation');
  }
  for (const effect of def.effects || []) {
    const eventType = immediateEvents[effect.op];
    if (preparesCounter && ['damage', 'poiseDamage'].includes(effect.op)) { uncovered.push('deferred-' + effect.op); continue; }
    if (effect.if || !eventType || typeof effect.amount !== 'number' || effect.amount <= 0) {
      uncovered.push(effect.op); continue;
    }
    const matching = events.filter(e => e.type === eventType && e.cardInstanceId === instanceId);
    assert.ok(matching.length, `${def.id}: unconditional ${effect.op} must emit ${eventType}`);
    if (effect.op === 'damage') assert.ok(matching.some(e => e.incoming > 0), `${def.id}: positive damage must reach defense processing`);
    covered.push(effect.op);
  }
  return { covered, uncovered };
}
export async function auditCards({ mode = 'native', allEnemies = false, allVariants = false } = {}) {
  const api = await loadAuditRuntime(mode), inventory = auditInventory(api.registries);
  const report = { mode, inventory: { cards: inventory.cardIds.length, classes: inventory.classes.length, candidates: inventory.variants.length },
    played: [], rejected: [], fixtureGaps: [], failures: [], contracts: {}, uncovered: {} };
  // First sweep isolates authored base definitions. Grades, carriers and upcast
  // conditions are separate coverage and are deliberately not claimed here.
  const base = allVariants ? inventory.variants : inventory.variants.filter(v => !v.instance.upgraded && !v.instance.profileId && v.upcastTier === undefined &&
    (v.instance.abilityRank === undefined || v.instance.abilityRank === 0));
  for (const variant of base) for (const enemyId of allEnemies ? inventory.enemyIds : ['wanderingSoldier', 'gildedKnight']) {
    const key = `${variant.key}/${enemyId}`;
    try {
      const carrierId = variant.instance.profileId ? variant.carrierIds[0] || null : undefined;
      const { combat: c } = makeAuditCombat(api, { classId: variant.classId, enemyIds: [enemyId], instance: variant.instance, relicIds: [], carrierId });
      const inst = c.piles.hand[0], def = api.resolveCombatCard(c, inst, { upcastTier: variant.upcastTier });
      const plan = api.cardTargetPlan(def, c.player.id, c.enemies, [c.player], { solo: true });
      const targetId = plan.legalIds[0];
      const choicePlan = api.cardChoicePlan(c, inst.instanceId);
      const choice = choicePlan?.options?.find(option => !option.active)?.id;
      const costs = api.cardPlayCosts(c, inst.instanceId, variant.upcastTier);
      const eventStart = c.eventLog.length;
      try { api.dispatch(c, { type: 'playCard', cardInstanceId: inst.instanceId, targetId, ...(choice ? { choice } : {}), ...(variant.upcastTier !== undefined ? { upcastTier: variant.upcastTier } : {}) }); }
      catch (error) {
        if (error.playRefusal?.reason === 'unplayable' && api.registries.framework.isUnplayable(def)) {
          assert.equal(c.eventLog.slice(eventStart).filter(e => e.type === 'cardPlayed').length, 0);
          report.rejected.push({ key, reason: 'authored unplayable' }); continue;
        }
        throw error;
      }
      settleAuditChoices(api, c);
      const events = c.eventLog.slice(eventStart), receipts = events.filter(e => e.type === 'cardPlayed' && e.cardInstanceId === inst.instanceId);
      assert.equal(receipts.length, 1, 'exactly one paid card receipt');
      assert.ok(events.some(e => e.type === 'cardResolved' && e.cardInstanceId === inst.instanceId), 'card resolved receipt');
      assert.equal(c.queue.length, 0, 'queue converges');
      assert.equal(api.reactionPaused(c), false, 'interaction resumes');
      for (const field of ['energySpent', 'manaSpent', 'staminaSpent']) assert.ok(Number.isFinite(receipts[0][field]) && receipts[0][field] >= 0, field);
      assert.equal(receipts[0].energySpent, costs.energy, 'paid Actions agree with effective cost');
      assert.equal(receipts[0].manaSpent, costs.mana, 'paid Mana agrees with effective cost');
      assert.equal(receipts[0].staminaSpent, costs.stamina, 'paid Stamina agrees with effective cost');
      const contract = assertImmediateContracts(def, events, inst.instanceId);
      for (const op of contract.covered) report.contracts[op] = (report.contracts[op] || 0) + 1;
      for (const op of contract.uncovered) report.uncovered[op] = (report.uncovered[op] || 0) + 1;
      const turn = c.turn;
      api.dispatch(c, { type: 'endTurn' });
      settleAuditChoices(api, c);
      assert.equal(c.queue.length, 0, 'end-turn queue converges');
      assert.equal(api.reactionPaused(c), false, 'end-turn choices converge');
      assert.ok(c.turn > turn, 'next turn starts');
      setAuditHand(c, [{ cardId: 'defend', instanceId: 'audit:followup' }]);
      api.dispatch(c, { type: 'playCard', cardInstanceId: 'audit:followup', targetId: c.player.id });
      settleAuditChoices(api, c);
      assert.ok(c.eventLog.some(e => e.type === 'cardPlayed' && e.cardInstanceId === 'audit:followup'), 'next-turn card works');
      report.played.push(key);
    } catch (error) {
      if (/^Carrier '.+' supplies no '.+' card$/.test(error.message)) { report.fixtureGaps.push({ key, reason: error.message }); continue; }
      report.failures.push({ key, message: error.message, refusal: error.playRefusal || null }); }
  }
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await auditCards({ mode: process.argv.includes('--bundled') ? 'bundled' : 'native', allEnemies: process.argv.includes('--all-enemies'), allVariants: process.argv.includes('--all-variants') });
  console.log(JSON.stringify(report));
  if (report.failures.length || report.fixtureGaps.length) process.exitCode = 1;
}
