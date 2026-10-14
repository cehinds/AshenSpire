import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { loadAuditRuntime } from './runtime.mjs';
import { makeAuditCombat, setAuditPredicate, settleAuditChoices } from './fixtures.mjs';
import { stanceRules } from '../../src/content/stanceRules.js';
import { spellDefenseRules } from '../../src/content/spellDefenseRules.js';
import { CARD_TRAIT_RULES } from '../../src/content/combatCardTraits.js';

const representatives = [
  { cardId: 'ironResolve', classId: 'reaver', indices: [0], maneuver: 'defend', camp: 'physical' },
  { cardId: 'executioner', classId: 'reaver', indices: [0, 1], maneuver: 'attack', camp: 'physical' },
  { cardId: 'umbralWard', classId: 'starseer', indices: [0], maneuver: 'counter', camp: 'spell', school: 'alteration' },
  { cardId: 'desperateRite', classId: 'herald', legacyAbility: true, indices: [0], maneuver: 'casting', camp: 'spell', school: 'decay' },
];
const stacks = (entity, id) => entity.statuses[id]?.stacks || 0;
function capture(c, target) {
  return { player: { hp: c.player.hp, block: c.player.block, barrier: c.player.barrier,
    ward: c.player.persistentWard.value, poise: c.player.persistentPoise.value,
    statuses: structuredClone(c.player.statuses), stanceId: c.player.stanceId,
    combatStance: structuredClone(c.player.combatStance || null) },
  target: { id: target.id, hp: target.hp, block: target.block,
    statuses: structuredClone(target.statuses), gauges: structuredClone(target.statusControl.gauges) },
  otherEnemy: { hp: c.enemies[0].hp, statuses: structuredClone(c.enemies[0].statuses) } };
}

// This oracle models only these four representatives and their authored
// coeffects. It never sums emitted packets or calls engine damage/protection
// resolvers. The expected amount comes from the selected projected face, plus
// normative content budgets for stance entry, recovery, hooks and modifiers.
function expectedTotals(api, c, representative, definition, target, before) {
  assert.equal(c.combatExpansionVersion, 2, 'current stance combat is active');
  assert.equal(c.reactionRulesVersion, 2, 'current authored card traits are active');
  assert.equal(c.ratingsRules, undefined, 'existing makeAuditCombat capability fixture supplies no ratings rules; none are disabled here');
  assert.equal(c.player.ratings, undefined);
  assert.equal(c.piles.hand[0].ratingValue, undefined, 'authored carrier has no saved rating override');
  const cfg = { ...stanceRules, ...(c.stanceRules || c.registries.balance.stanceRules || {}) };
  const selected = definition.effects.map((effect, index) => ({ effect, index }))
    .filter(({ effect }) => !effect.if || api.evalPredicate(c, effect.if, { source: c.player, owner: c.player, target }));
  const expected = { block: before.player.block, barrier: before.player.barrier, ward: before.player.ward,
    hpLoss: 0, precision: 0, starstoneCharge: before.player.statuses.starstoneCharge?.stacks || 0,
    necroticGauge: before.target.gauges.necroticBlight?.value || 0,
    ratingBonus: 0, contributions: [], selectedEffectIndices: selected.map(row => row.index) };
  const add = (kind, values) => { expected.contributions.push({ kind, ...values }); };
  const offensive = ['attack', 'counter', 'casting'].includes(representative.maneuver);
  if (offensive) expected.precision = cfg.offensivePrecision;
  if (['defend', 'counter'].includes(representative.maneuver)) {
    const blockShare = representative.camp === 'spell'
      ? cfg.schoolBlockShares[representative.school] ?? cfg.spellBlockShare : 1;
    const block = Math.round(cfg.entryProtection * blockShare), barrier = cfg.entryProtection - block;
    expected.block += block; expected.barrier += barrier; add('stance-entry', { block, barrier });
  }
  if (representative.maneuver === 'defend') {
    assert.equal(c.player.persistentPoise.max, 0); assert.equal(c.player.persistentWard.max, 0);
    expected.block += cfg.defenseRestore; expected.barrier += cfg.defenseRestore;
    add('defense-restore-overflow', { block: cfg.defenseRestore, barrier: cfg.defenseRestore });
  }
  for (const { effect, index } of selected) {
    if (['block', 'gainBarrier'].includes(effect.op)) {
      assert.equal(typeof effect.amount, 'number');
      let amount = effect.amount;
      if (definition.traitValues?.counterstrike) {
        // The friendly selected target supplies no opposing stance: base +50%.
        const pct = (c.reactionRules || CARD_TRAIT_RULES).counterstrike.pct;
        amount += Math.max(1, Math.floor(amount * pct));
        add('counterstrike', { effectIndex: index, base: effect.amount, pct, amount });
      }
      if (representative.camp === 'spell') {
        const wardShare = spellDefenseRules.schools[representative.school] ?? spellDefenseRules.defaultWardShare;
        const block = Math.round(amount * (1 - wardShare)), barrier = amount - block;
        expected.block += block; expected.barrier += barrier;
        add('selected-protection', { effectIndex: index, amount, block, barrier });
      } else { expected.block += amount; add('selected-protection', { effectIndex: index, amount, block: amount }); }
    } else if (effect.op === 'damage') {
      assert.equal(typeof effect.amount, 'number');
      const mult = stacks(target, 'staggered') ? api.registries.statuses.get('staggered').modifiers.damageTakenMult : 1;
      const amount = Math.floor(effect.amount * mult);
      expected.hpLoss += amount; add('selected-damage', { effectIndex: index, base: effect.amount, targetStatusMultiplier: mult, amount });
    } else if (effect.op === 'applyStatus') {
      assert.equal(effect.status, 'starstoneCharge');
      assert.equal(api.registries.statuses.get(effect.status).stackMode, 'unique');
      expected.starstoneCharge = 1;
      add('unique-starstone-coeffect', { actualStacks: 1, spellBonus: cfg.spellStatusStacks });
    } else if (effect.op === 'buildup') {
      assert.equal(effect.status, 'necroticBlight'); assert.equal(typeof effect.amount, 'number');
      const amount = effect.amount + cfg.spellStatusStacks;
      assert.ok(amount < c.combatExpansionRules.statuses.statuses.necroticBlight.initialThreshold);
      expected.necroticGauge += amount; add('spell-buildup-coeffect', { authored: effect.amount, spellBonus: cfg.spellStatusStacks, amount });
    } else throw new Error(`Unexpected representative coeffect ${effect.op}`);
  }
  if (before.player.stanceId === 'bulwark') {
    const hook = api.registries.stances.get('bulwark').hooks.find(hook => hook.on === 'cardPlayed' && hook.if.p === 'cardTypeIs' && hook.if.type === definition.type);
    assert.ok(hook); assert.equal(hook.do.length, 1); assert.equal(hook.do[0].op, 'block');
    expected.block += hook.do[0].amount; add('bulwark-skill-hook', { block: hook.do[0].amount });
  }
  return expected;
}

export async function auditConditionalFamilyContracts({ mode = 'native' } = {}) {
  const api = await loadAuditRuntime(mode);
  const report = { mode, scope: 'five representative predicate families; no claim for ambiguous effect-index rows', plays: [], families: [] };
  for (const representative of representatives) {
    const branchRows = [];
    for (const truth of [true, false]) {
      const instance = { cardId: representative.cardId, ...(representative.legacyAbility ? { legacyAbility: true } : {}) };
      const { combat: c } = makeAuditCombat(api, { classId: representative.classId, instance, relicIds: [], enemyIds: ['wanderingSoldier', 'wanderingSoldier'] });
      const inst = c.piles.hand[0], definition = api.resolveCombatCard(c, inst), target = c.enemies[1];
      for (const enemy of c.enemies) {
        enemy.block = enemy.barrier = 0; enemy.persistentWard.value = enemy.persistentPoise.value = 0;
        enemy.poiseMeter.max = 10000; // Direct hits cannot introduce a new stagger coeffect.
      }
      setAuditPredicate(c, definition.effects[0].if, truth, target);
      assert.equal(api.evalPredicate(c, definition.effects[0].if, { source: c.player, owner: c.player, target }), truth);
      assert.equal(api.evalPredicate(c, definition.effects[1].if, { source: c.player, owner: c.player, target }), !truth,
        'authored second effect is the complementary branch');
      const plan = api.cardTargetPlan(definition, c.player.id, c.enemies, [{ ...c.player, connected: true }], { solo: true });
      const targetId = plan.mode === 'enemy' ? target.id : c.player.id;
      assert.ok(plan.legalIds.includes(targetId));
      const before = capture(c, target), expected = expectedTotals(api, c, representative, definition, target, before);
      const start = c.eventLog.length;
      api.dispatch(c, { type: 'playCard', cardInstanceId: inst.instanceId, targetId }); settleAuditChoices(api, c);
      const events = c.eventLog.slice(start), paid = events.filter(e => e.type === 'cardPlayed' && e.cardInstanceId === inst.instanceId);
      assert.equal(paid.length, 1); assert.equal(paid[0].targetId, targetId);
      assert.ok(events.some(e => e.type === 'cardResolved' && e.cardInstanceId === inst.instanceId));
      assert.equal(c.queue.length, 0); assert.equal(api.reactionPaused(c), false);
      const after = capture(c, target);
      assert.equal(after.player.block, expected.block, 'exact actual Block includes only selected branch and legitimate coeffects');
      assert.equal(after.player.barrier, expected.barrier); assert.equal(after.player.ward, expected.ward);
      assert.equal(before.target.hp - after.target.hp, expected.hpLoss, 'exact selected enemy HP delta proves authored branch');
      assert.equal(stacks(c.player, 'precision'), expected.precision);
      assert.equal(stacks(c.player, 'starstoneCharge'), expected.starstoneCharge);
      assert.equal(target.statusControl.gauges.necroticBlight?.value || 0, expected.necroticGauge);
      assert.deepEqual(after.otherEnemy, before.otherEnemy, 'non-first selected target does not leak onto another enemy');
      assert.equal(c.player.combatStance.maneuver, representative.maneuver); assert.equal(c.player.combatStance.camp, representative.camp);
      const row = { key: `${representative.cardId}/${truth ? 'primary-positive' : 'primary-negative'}`,
        instance, selectedTargetId: targetId, predicateTargetId: representative.cardId === 'executioner' ? target.id : c.player.id,
        before, expected, after,
        fixture: { combatExpansionVersion: c.combatExpansionVersion, reactionRulesVersion: c.reactionRulesVersion,
          ratings: 'makeAuditCombat default: no ratingsRules/player.ratings, no saved ratingValue override',
          profileId: inst.profileId || null, abilityRank: inst.abilityRank ?? null,
          dtoChanges: ['predicate state via setAuditPredicate', 'two living enemies', 'enemy Block/Barrier/Ward/Poise pools emptied',
            'enemy Poise meter maximum 10000 prevents additional stagger from a direct hit'],
          modifiedRuleFlags: [] },
        paid: { cardId: paid[0].cardId, cardInstanceId: paid[0].cardInstanceId, targetId: paid[0].targetId,
          energySpent: paid[0].energySpent, staminaSpent: paid[0].staminaSpent, manaSpent: paid[0].manaSpent } };
      report.plays.push(row); branchRows.push(row);
    }
    for (const effectIndex of representative.indices) {
      const { combat } = makeAuditCombat(api, { classId: representative.classId, instance: { cardId: representative.cardId,
        ...(representative.legacyAbility ? { legacyAbility: true } : {}) }, relicIds: [] });
      const effect = api.resolveCombatCard(combat, combat.piles.hand[0]).effects[effectIndex];
      const branches = branchRows.map((row, index) => ({ playKey: row.key, truth: effectIndex === 1 ? index === 1 : index === 0 }));
      report.families.push({ predicate: effect.if, predicateJson: JSON.stringify(effect.if), cardId: representative.cardId,
        legacyAbility: representative.legacyAbility || false, effectIndex, op: effect.op, branches });
    }
  }
  assert.equal(new Set(report.families.map(row => row.predicateJson)).size, 5);
  return structuredClone(report);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await auditConditionalFamilyContracts({ mode: process.argv.includes('--bundled') ? 'bundled' : 'native' })));
}
