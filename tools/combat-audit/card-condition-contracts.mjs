import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { loadAuditRuntime } from './runtime.mjs';
import { auditInventory } from './inventory.mjs';
import { makeAuditCombat, setAuditPredicate, setAuditHand, settleAuditChoices } from './fixtures.mjs';
import { stanceRules } from '../../src/content/stanceRules.js';

export const CONDITION_CARD_IDS = Object.freeze(['clearHead', 'progression-cinder-guard',
  'progression-wire-snare', 'blightBloom', 'progression-ossuary-cant', 'progression-requiem-brand']);
const stacks = (entity, status) => entity.statuses[status]?.stacks || 0;
const gauge = (entity, status) => entity.statusControl.gauges[status]?.value || 0;
const compactReceipt = ({ abilityBefore, abilityEntities, ...receipt }) => receipt;

function variantsFor(api) {
  const inventory = auditInventory(api.registries);
  const variants = inventory.variants.filter(v => CONDITION_CARD_IDS.includes(v.instance.cardId)
    && !v.instance.profileId && v.upcastTier === undefined);
  // Migration preserves the old printed face even where legacyFace is absent.
  // Exercise those real saved instances as well as all current authored grades.
  for (const cardId of CONDITION_CARD_IDS) {
    const card = api.registries.cards.get(cardId);
    if (!card.gradeProfiles || variants.some(v => v.instance.cardId === cardId && v.instance.legacyAbility)) continue;
    for (const upgraded of card.upgrade ? [false, true] : [false]) variants.push({
      key: `${card.class}/${cardId}/${upgraded ? 'upgraded' : 'base'}/saved-legacy/authored/base`,
      classId: card.class, instance: { cardId, upgraded, legacyAbility: true },
    });
  }
  return variants;
}
function fixture(api, variant) {
  const { combat } = makeAuditCombat(api, { classId: variant.classId,
    enemyIds: ['wanderingSoldier', 'wanderingSoldier'], instance: variant.instance, relicIds: [] });
  // Leave room for recovery and isolate conditional status delivery from defenses.
  combat.player.energy = combat.player.stamina = 20;
  for (const enemy of combat.enemies) {
    enemy.block = 0; enemy.poiseMeter = { value: 0, max: 0 };
    enemy.persistentWard.value = 0;
  }
  return combat;
}
function play(api, c, instance, targetId) {
  const start = c.eventLog.length;
  api.dispatch(c, { type: 'playCard', cardInstanceId: instance.instanceId, targetId });
  settleAuditChoices(api, c);
  const events = c.eventLog.slice(start), own = events.filter(e => e.cardInstanceId === instance.instanceId);
  const paid = own.filter(e => e.type === 'cardPlayed');
  assert.equal(paid.length, 1, 'one actual paid play');
  assert.equal(paid[0].targetId, targetId, 'paid receipt records the selected target');
  assert.ok(own.some(e => e.type === 'cardResolved'), 'real queued effects resolve');
  assert.equal(c.queue.length, 0); assert.equal(api.reactionPaused(c), false);
  return { events, own, paid: paid[0] };
}
function state(c, target, effect) {
  return { dazed: stacks(c.player, 'dazed'), roll: structuredClone(c.player.nextEvadeMode || null),
    block: c.player.block, stance: structuredClone(c.player.combatStance || null),
    charges: structuredClone(c.player.abilityRiders.charges),
    energy: c.player.energy, stamina: c.player.stamina,
    statuses: structuredClone(target.statuses), gauge: effect.status ? gauge(target, effect.status) : null };
}
function branchCases(effect) {
  if (effect.if.p !== 'any') return [{ name: 'absent', truth: false }, { name: 'present', truth: true }];
  return [{ name: 'absent', truth: false }, ...effect.if.preds.map(predicate => ({
    name: predicate.status, truth: true, predicate,
  })), { name: effect.if.preds[0].of === 'allEnemies' ? 'dead-only' : 'other-enemy-only', truth: false, decoy: true }];
}
function seed(api, c, effect, branch, target) {
  setAuditPredicate(c, effect.if, false, target);
  if (branch.truth) {
    if (branch.predicate) {
      const predicate = branch.predicate.of === 'allEnemies' ? { ...branch.predicate, of: 'target' } : branch.predicate;
      setAuditPredicate(c, predicate, true, target);
    } else setAuditPredicate(c, effect.if, true, target);
  }
  if (branch.decoy) {
    const other = c.enemies[0];
    for (const predicate of effect.if.preds) setAuditPredicate(c, { ...predicate, of: 'target' }, true, other);
    if (effect.if.preds[0].of === 'allEnemies') { other.alive = false; other.hp = 0; }
  }
  assert.equal(api.evalPredicate(c, effect.if, { source: c.player, owner: c.player, target }), branch.truth,
    `${branch.name}: capability state establishes authored predicate`);
}
// Normative rule: non-melee offensive magic enters Spell; each successful,
// positive authored status effect gets the configured Spell status bonus.
// Read content defaults and the actual stance DTO, never the pressure receipt
// or the engine's status-bonus resolver, to predict the full state mutation.
export function expectedConditionalBuildup(c, effect, before) {
  let authored = effect.amount;
  if (typeof authored !== 'number') {
    assert.equal(authored.f, 'mul');
    assert.equal(authored.args[0].f, 'stacks');
    assert.equal(authored.args[0].status, effect.status);
    assert.equal(authored.args[0].of, 'target');
    assert.equal(typeof authored.args[1], 'number');
    authored = (before.statuses[effect.status]?.stacks || 0) * authored.args[1];
  }
  const stance = c.player.combatStance;
  const spellStance = ['casting', 'spell'].includes(stance?.maneuver)
    || stance?.maneuver === 'counter' && stance?.camp === 'spell';
  const rules = { ...stanceRules, ...(c.stanceRules || c.registries?.balance?.stanceRules || {}) };
  const bonus = c.combatExpansionVersion === 2 && authored > 0 && spellStance ? rules.spellStatusStacks : 0;
  return { authored, spellStanceBonus: bonus, total: authored + bonus };
}
function assertPressure(c, target, effect, before, own, truth) {
  const packets = own.filter(e => e.type === 'statusPressure' && e.status === effect.status);
  const rule = c.combatExpansionRules.statuses.statuses[effect.status];
  if (!truth) {
    assert.equal(packets.length, 0, 'false predicate prevents this status delivery');
    assert.equal(gauge(target, effect.status), before.gauge);
    assert.equal(stacks(target, rule.activeStatus), before.statuses[rule.activeStatus]?.stacks || 0);
    return [];
  }
  assert.equal(packets.length, 1); assert.equal(packets[0].targetId, target.id);
  assert.equal(packets[0].resisted, 0, 'fixture leaves authored buildup unresisted');
  const initialStacks = before.statuses[rule.activeStatus]?.stacks || 0;
  // Independent conservation oracle: buildup becomes gauge units and/or active stacks.
  const added = stacks(target, rule.activeStatus) - initialStacks;
  const spent = added ? (initialStacks ? rule.activeThreshold : rule.initialThreshold) + (added - 1) * rule.activeThreshold : 0;
  const expected = expectedConditionalBuildup(c, effect, before);
  assert.ok(expected.total > 0); assert.equal(gauge(target, effect.status) - before.gauge + spent, expected.total,
    'authored buildup reaches actual gauge/stack state');
  assert.equal(packets[0].value, gauge(target, effect.status));
  assert.equal(packets[0].activeAdded, added);
  return packets.map(compactReceipt);
}
function strikeFollowup(api, c, effect, target, truth) {
  setAuditHand(c, [{ cardId: 'strike', instanceId: 'audit:eligible-strike' }]);
  const instance = c.piles.hand[0], definition = api.resolveCombatCard(c, instance);
  assert.equal(definition.type, effect.cardType, 'follow-up is eligible for authored charge');
  const hp = target.hp;
  const { own, events } = play(api, c, instance, target.id);
  const damage = own.filter(e => e.type === 'damageDealt' && e.targetId === target.id);
  assert.equal(damage.length, 1);
  assert.equal(hp - target.hp, damage[0].amount, 'charged Strike changes selected enemy HP');
  assert.equal(c.player.abilityRiders.charges[effect.key], undefined, 'eligible Strike consumes the charge');
  return { base: damage[0].base, hpLost: hp - target.hp,
    consumed: events.filter(e => e.type === 'cardChargeConsumed' && e.cardId === instance.cardId && e.sourceId === c.player.id).map(compactReceipt), truth };
}

export async function auditCardConditionContracts({ mode = 'native' } = {}) {
  const api = await loadAuditRuntime(mode), variants = variantsFor(api);
  const report = { mode, contracts: [], unconditionalFaces: [], failures: [] };
  for (const variant of variants) {
    const sample = fixture(api, variant), definition = api.resolveCombatCard(sample, sample.piles.hand[0]);
    const conditional = definition.effects.map((effect, index) => ({ effect, index })).filter(row => row.effect.if);
    if (!conditional.length) { report.unconditionalFaces.push(variant.key); continue; }
    for (const { effect, index } of conditional) {
      const contract = { key: `${variant.key}/effect:${index}`, cardId: variant.instance.cardId,
        instance: variant.instance, op: effect.op, effectIndex: index, predicate: effect.if,
        intended: effect, branches: [] };
      for (const branch of branchCases(effect)) {
        const c = fixture(api, variant), inst = c.piles.hand[0], def = api.resolveCombatCard(c, inst);
        const target = c.enemies[1]; // Explicitly exercise a non-first selected enemy.
        seed(api, c, effect, branch, target);
        if (effect.status === 'weak' && typeof effect.amount === 'number') {
          const rule = c.combatExpansionRules.statuses.statuses.weak;
          // The same pending gauge in both branches proves an actual Weak stack,
          // rather than mistaking a pressure receipt for an active debuff.
          target.statusControl.gauges.weak = { value: rule.initialThreshold - effect.amount,
            camp: effect.camp, recoveryProfile: effect.recoveryProfile };
        }
        const plan = api.cardTargetPlan(def, c.player.id, c.enemies, [{ ...c.player, connected: true }], { solo: true });
        const targetId = plan.mode === 'enemy' ? target.id : c.player.id;
        assert.ok(plan.legalIds.includes(targetId));
        const before = state(c, target, effect), { own, paid } = play(api, c, inst, targetId);
        assert.equal(api.evalPredicate(c, effect.if, { source: c.player, owner: c.player, target, event: paid }), branch.truth,
          'paid beforePlay snapshot preserves the established branch');
        const afterCard = state(c, target, effect);
        let receipts = [], followup = null, outcome = 'state-change';
        if (effect.op === 'grantRollMode') {
          assert.equal(stacks(c.player, 'dazed'), 0, 'Clear Head removes Dazed before granting its roll mode');
          assert.equal(stacks(paid.abilityEntities[c.player.id], 'dazed'), branch.truth ? 1 : 0,
            'actual paid snapshot captures Dazed before removal');
          assert.deepEqual(structuredClone(c.player.nextEvadeMode || null), branch.truth ? { advantage: true, disadvantage: false } : null);
          assert.equal(api.evalPredicate(c, { ...effect.if, snapshot: undefined }, { owner: c.player, target: c.player }), false,
            'live condition is false after status removal');
        } else if (effect.op === 'grantCardCharge') {
          const charge = c.player.abilityRiders.charges[effect.key];
          assert.equal(charge?.damage || 0, branch.truth ? effect.damage : 0);
          assert.ok(c.player.block > before.block, 'Block is granted even on the false beforePlay branch');
          assert.equal(paid.abilityEntities[c.player.id].block, branch.truth ? 20 : 0);
          followup = strikeFollowup(api, c, effect, target, branch.truth);
        } else if (effect.op === 'gainEnergy') {
          const packets = own.filter(e => e.type === 'energyGained');
          const recovery = branch.truth ? Math.max(0, effect.amount - (effect.funded || 0)) : 0;
          assert.equal(packets.length, branch.truth ? 1 : 0);
          if (branch.truth) assert.equal(packets[0].amount, recovery);
          assert.equal(c.player.energy, before.energy - paid.energySpent + recovery);
          assert.equal(c.player.stamina, before.stamina - paid.staminaSpent,
            'funded Actions do not invent Stamina recovery');
          assert.ok(before.energy < c.player.energyMax && before.stamina < c.player.maxStamina);
          outcome = effect.funded === effect.amount ? 'funded-neutral-after-payment' : 'state-change';
          receipts = packets.map(compactReceipt);
        } else {
          assert.equal(effect.op, 'buildup');
          receipts = assertPressure(c, target, effect, before, own, branch.truth);
          assert.deepEqual(structuredClone(c.enemies[0].statusControl.gauges), {}, 'conditional status never reaches the unselected enemy');
        }
        const scope = effect.if.of || effect.if.preds?.[0].of;
        contract.branches.push({ name: branch.name, truth: branch.truth, selectedTargetId: targetId,
          predicateTargetIds: scope === 'self' ? [c.player.id] : scope === 'allEnemies'
            ? c.enemies.filter(enemy => enemy.alive).map(enemy => enemy.id) : [target.id],
          outcome, before, after: afterCard,
          beforePlaySnapshot: Object.fromEntries(Object.entries(paid.abilityEntities).map(([id, entity]) =>
            [id, { alive: entity.alive, block: entity.block, statuses: structuredClone(entity.statuses) }])),
          ...(followup ? { afterFollowup: state(c, target, effect) } : {}),
          ...(effect.op === 'buildup' ? { expectedBuildup: branch.truth
            ? expectedConditionalBuildup(c, effect, before) : { authored: 0, spellStanceBonus: 0, total: 0 } } : {}),
          paid: compactReceipt(paid), receipts, followup });
      }
      if (effect.op === 'grantCardCharge') {
        const [negative, positive] = contract.branches;
        assert.equal(positive.followup.base - negative.followup.base, effect.damage,
          'actual eligible Strike damage increases by the authored charge');
        assert.equal(positive.followup.hpLost - negative.followup.hpLost, effect.damage);
        assert.ok(positive.followup.consumed.some(e => e.keys.includes(effect.key)), 'charge consumption has an actual paid follow-up receipt');
        assert.equal(negative.followup.consumed.length, 0);
      }
      report.contracts.push(contract);
    }
  }
  return structuredClone(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await auditCardConditionContracts({ mode: process.argv.includes('--bundled') ? 'bundled' : 'native' })));
}
