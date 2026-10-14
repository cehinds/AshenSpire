import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { loadAuditRuntime } from './runtime.mjs';
import { auditInventory } from './inventory.mjs';
import { makeAuditCombat, settleAuditChoices, setAuditHand, setAuditPredicate } from './fixtures.mjs';

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
    resourceDeltaChecks: 0, played: [], rejected: [], fixtureGaps: [], failures: [], contracts: {}, uncovered: {} };
  // First sweep isolates authored base definitions. Grades, carriers and upcast
  // conditions are separate coverage and are deliberately not claimed here.
  const base = allVariants ? inventory.variants : inventory.variants.filter(v => !v.instance.upgraded && !v.instance.profileId && !v.instance.legacyAbility && v.upcastTier === undefined &&
    (v.instance.abilityRank === undefined || v.instance.abilityRank === 0));
  for (const variant of base) for (const enemyId of allEnemies ? inventory.enemyIds : ['wanderingSoldier', 'gildedKnight']) {
    const key = `${variant.key}/${enemyId}`;
    try {
      const carrierId = variant.instance.profileId ? variant.carrierIds[0] || null : undefined;
      const { combat: c } = makeAuditCombat(api, { classId: variant.classId, enemyIds: [enemyId], instance: variant.instance, relicIds: [], carrierId });
      const inst = c.piles.hand[0], def = api.resolveCombatCard(c, inst, { upcastTier: variant.upcastTier });
      const plan = api.cardTargetPlan(def, c.player.id, c.enemies, [{ ...c.player, connected: true }], { solo: true });
      const targetId = plan.legalIds[0];
      const choicePlan = api.cardChoicePlan(c, inst.instanceId);
      const choice = choicePlan?.options?.find(option => !option.active)?.id;
      const costs = api.cardPlayCosts(c, inst.instanceId, variant.upcastTier);
      const beforePools = { energy: c.player.energy, mana: c.player.mana };
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
      const restoredStamina = events.filter(e => e.type === 'energyGained' || e.type === 'staminaRecovered' && e.targetId === c.player.id).reduce((n, e) => n + e.amount, 0);
      const restoredMana = events.filter(e => e.type === 'manaRestored' && e.targetId === c.player.id).reduce((n, e) => n + e.amount, 0);
      assert.equal(c.player.energy, beforePools.energy - receipts[0].energySpent + restoredStamina, 'actual Actions payment/restoration ledger');
      assert.equal(c.player.stamina, beforePools.energy - receipts[0].staminaSpent + restoredStamina, 'actual Stamina payment/restoration ledger');
      assert.equal(c.player.mana, beforePools.mana - receipts[0].manaSpent + restoredMana, 'actual Mana payment/restoration ledger');
      report.resourceDeltaChecks++;
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
function conditionalTargets(c, effect, chosen) {
  if (effect.target === 'self' || effect.target === 'ally') return [c.player.id];
  if (['allEnemies', 'randomEnemy'].includes(effect.target)) return c.enemies.filter(e => e.alive).map(e => e.id);
  if (effect.target === 'otherEnemies') return c.enemies.filter(e => e.alive && e.id !== chosen.id).map(e => e.id);
  return [chosen.id];
}
function proveConditionalMutation(api, c, effect, chosen, inst, before, events, packets) {
  const targets = conditionalTargets(c, effect, chosen);
  for (const packet of packets) if (effect.op !== 'draw') assert.ok(targets.includes(packet.targetId), 'effect receipt names its actual destination');
  for (const id of targets) {
    const entity = [c.player, ...c.enemies].find(e => e.id === id), old = before.entities[id];
    const losses = events.filter(e => e.type === 'hpLost' && e.targetId === id).reduce((n, e) => n + e.amount, 0);
    const heals = events.filter(e => e.type === 'healed' && e.targetId === id).reduce((n, e) => n + e.amount, 0);
    assert.equal(entity.hp, old.hp - losses + heals, 'actual HP agrees with attributed effects and other HP events');
    if (effect.op === 'damage') {
      const damage = events.filter(e => e.type === 'damageDealt' && e.targetId === id && e.cardInstanceId === inst.instanceId && !e.triggeredBy)
        .reduce((n, e) => n + Math.max(0, e.amount - e.blocked), 0);
      const lost = events.filter(e => e.type === 'hpLost' && e.cause === 'attack' && e.targetId === id && e.cardInstanceId === inst.instanceId && !e.triggeredBy)
        .reduce((n, e) => n + e.amount, 0);
      assert.equal(lost, damage, 'damage packets commit their post-defense HP loss');
    }
    if (effect.op === 'block') {
      const gained = events.filter(e => e.type === 'blockGained' && e.targetId === id).reduce((n, e) => n + e.amount, 0);
      const spent = events.filter(e => e.type === 'damageDealt' && e.targetId === id).reduce((n, e) => n + e.blocked, 0);
      assert.equal(entity.block, old.block + gained - spent, 'Block operation changes the target pool');
    }
    if (effect.op === 'gainBarrier') {
      const gained = events.filter(e => e.type === 'barrierGained' && e.targetId === id).reduce((n, e) => n + e.amount, 0);
      const spent = events.filter(e => e.type === 'damageDealt' && e.targetId === id).reduce((n, e) => n + (e.barrierAbsorbed || 0), 0);
      assert.equal(entity.barrier || 0, old.barrier + gained - spent, 'Barrier receipts commit an actual target pool change');
    }
    if (effect.op === 'applyStatus' && packets.some(e => e.targetId === id)) {
      const changed = JSON.stringify(entity.statuses[effect.status]) !== JSON.stringify(old.statuses[effect.status]);
      const completed = events.some(e => ['statusRemoved', 'statusExpired', 'meterFilled'].includes(e.type) && e.targetId === id && e.status === effect.status);
      assert.ok(changed || completed, 'status operation changes target state or completes its lifecycle');
    }
  }
  if (effect.op === 'draw') {
    for (const packet of packets) {
      assert.ok(before.draw.includes(packet.cardInstanceId) || before.discard.includes(packet.cardInstanceId), 'draw receipt came from the actual deck');
      assert.ok(['hand', 'discard', 'exhaust'].some(p => c.piles[p].some(i => i.instanceId === packet.cardInstanceId)), 'drawn card actually leaves draw and enters a destination pile');
    }
  }
}
export async function auditConditionalCards({ mode = 'native' } = {}) {
  const api = await loadAuditRuntime(mode), inventory = auditInventory(api.registries);
  const report = { mode, verified: [], uncovered: [], failures: [] };
  const eventTypes = { damage: 'damageDealt', block: 'blockGained', heal: 'healed', applyStatus: 'statusApplied', draw: 'cardDrawn', gainBarrier: 'barrierGained' };
  const seen = new Set();
  for (const variant of inventory.variants.filter(v => !v.instance.upgraded && !v.instance.profileId && v.upcastTier === undefined)) {
    const { combat: sample } = makeAuditCombat(api, { classId: variant.classId, instance: variant.instance, relicIds: [] });
    const definition = api.resolveCombatCard(sample, sample.piles.hand[0]);
    for (const [index, effect] of (definition.effects || []).entries()) {
      if (!effect.if) continue;
      const key = `${variant.key}/effect:${index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const type = eventTypes[effect.op];
      if (!type || (definition.cardTags || definition.tags || []).includes('maneuver:counter')) {
        report.uncovered.push({ key, condition: effect.if, reason: 'deferred or unsupported operation contract' }); continue;
      }
      try {
        const counts = [], amountCounts = [], otherPredicates = [];
        for (const truth of [false, true]) {
          const { combat: c } = makeAuditCombat(api, { classId: variant.classId, instance: variant.instance, relicIds: [] });
          const initialDef = api.resolveCombatCard(c, c.piles.hand[0]);
          const initialPlan = api.cardTargetPlan(initialDef, c.player.id, c.enemies, [{ ...c.player, connected: true }], { solo: true });
          const target = initialPlan.mode === 'enemy' ? c.enemies[0] : c.player;
          // Healing must have room in both branches; HP predicates then set their exact side of the threshold.
          if (effect.op === 'heal') for (const id of conditionalTargets(c, effect, target)) {
            const entity = [c.player, ...c.enemies].find(e => e.id === id);
            entity.hp = Math.floor(entity.maxHp * 0.6);
          }
          setAuditPredicate(c, effect.if, truth, target);
          otherPredicates.push(initialDef.effects.map((e, i) => i === index || !e.if ? null : api.evalPredicate(c, e.if, { owner: c.player, source: c.player, target })));
          assert.equal(api.evalPredicate(c, effect.if, { owner: c.player, source: c.player, target }), truth, 'fixture establishes predicate');
          const inst = c.piles.hand[0], def = api.resolveCombatCard(c, inst);
          const plan = api.cardTargetPlan(def, c.player.id, c.enemies, [{ ...c.player, connected: true }], { solo: true });
          const before = { entities: Object.fromEntries([c.player, ...c.enemies].map(e => [e.id, { hp: e.hp, block: e.block, barrier: e.barrier || 0, statuses: structuredClone(e.statuses) }])),
            draw: c.piles.draw.map(i => i.instanceId), discard: c.piles.discard.map(i => i.instanceId) };
          const start = c.eventLog.length;
          api.dispatch(c, { type: 'playCard', cardInstanceId: inst.instanceId, targetId: plan.legalIds[0] });
          settleAuditChoices(api, c);
          const events = c.eventLog.slice(start);
          const packets = events.filter(e => e.type === type && !e.triggeredBy && e.sourceId === c.player.id &&
            (effect.op === 'draw' || e.cardInstanceId === inst.instanceId) &&
            (effect.op !== 'applyStatus' || e.status === effect.status));
          proveConditionalMutation(api, c, effect, target, inst, before, events, packets);
          counts.push(packets.length);
          amountCounts.push(packets.filter(e => (effect.op === 'damage' ? e.base : e.amount) === effect.amount).length);
        }
        const competitors = definition.effects.filter((e, i) => i !== index && e.op === effect.op && (effect.op !== 'applyStatus' || e.status === effect.status));
        const competitorIndices = definition.effects.flatMap((e, i) => i !== index && e.op === effect.op && (effect.op !== 'applyStatus' || e.status === effect.status) ? [i] : []);
        const stableCompetitors = competitorIndices.every(i => otherPredicates[0][i] === otherPredicates[1][i]);
        const uniqueAmount = competitors.every(e => e.amount !== effect.amount);
        const amountContract = stableCompetitors && uniqueAmount && typeof effect.amount === 'number' && ['damage', 'block', 'heal'].includes(effect.op) && amountCounts[1] > amountCounts[0];
        if (!stableCompetitors || (!uniqueAmount && competitors.length > 0)) report.uncovered.push({ key, condition: effect.if, reason: 'coeffects prevent independent effect-index attribution', otherPredicates });
        else if (counts[1] <= counts[0] && !amountContract) report.uncovered.push({ key, condition: effect.if, counts, reason: 'state branch has no separable operation-count increase; needs amount or lifecycle contract' });
        else report.verified.push({ key, condition: effect.if, op: effect.op, contract: amountContract ? 'authored amount packet' : 'operation count', negative: amountContract ? amountCounts[0] : counts[0], positive: amountContract ? amountCounts[1] : counts[1] });
      } catch (error) {
        if (error.playRefusal?.reason === 'controlled') report.uncovered.push({ key, condition: effect.if, reason: 'positive capability state prevents ordinary play; needs recovery intent contract' });
        else report.failures.push({ key, condition: effect.if, message: error.message });
      }
    }
  }
  return report;
}
export async function auditCounterLifecycle({ mode = 'native' } = {}) {
  const api = await loadAuditRuntime(mode), cases = [];
  for (const scenario of ['eligible-blocked', 'eligible-unblocked', 'ineligible-spell', 'declined']) {
    const { combat: c } = makeAuditCombat(api, { classId: 'reaver', enemyIds: [scenario === 'ineligible-spell' ? 'mirrorScribe' : 'wanderingSoldier'],
      instance: { cardId: 'guardCounter', abilityRank: 0 }, relicIds: [] });
    const inst = c.piles.hand[0], enemy = c.enemies[0], hp = enemy.hp, turn = c.turn;
    const initialEvents = c.eventLog.length;
    if (scenario === 'eligible-blocked' || scenario === 'ineligible-spell') c.player.block = 10000;
    if (scenario !== 'declined') {
      api.dispatch(c, { type: 'playCard', cardInstanceId: inst.instanceId, targetId: c.player.id });
      assert.equal(enemy.hp, hp, 'preparing a reply does not hit immediately');
      assert.equal(c.player.combatCounter.payload.hp, 3, 'grade-zero authored reply payload is retained');
    }
    api.dispatch(c, { type: 'endTurn' });
    if (scenario === 'declined') assert.ok(c.pendingReaction?.options.some(o => o.cardId === 'guardCounter'), 'real attack offers the held counter');
    const choices = settleAuditChoices(api, c);
    const events = c.eventLog.slice(initialEvents);
    const returns = events.filter(e => e.type === 'damageDealt' && e.cardInstanceId === inst.instanceId);
    const consumed = events.filter(e => e.type === 'combatCounterConsumed' && e.cardInstanceId === inst.instanceId);
    if (scenario === 'eligible-blocked') {
      // SPEC trait contract: stance advantage adds floor(3 × .75) = 2.
      assert.equal(returns.length, 1);
      assert.equal(returns[0].base, 5);
      assert.equal(returns[0].amount, Math.ceil(5 * 1.5), 'Counter versus Attack uses the implemented 1.5 stance multiplier');
      assert.equal(enemy.hp, hp - Math.ceil(5 * 1.5));
      assert.equal(consumed.length, 1);
    } else {
      assert.equal(returns.length, 0, 'no return when the attack leaks HP, does not match, or was declined');
      assert.equal(enemy.hp, hp);
      assert.equal(consumed.length, scenario === 'eligible-unblocked' ? 1 : 0);
    }
    if (scenario === 'declined') assert.equal(events.filter(e => e.type === 'cardPlayed' && e.cardInstanceId === inst.instanceId).length, 0, 'declining pays no card');
    assert.ok(c.turn > turn);
    assert.equal(c.player.combatCounter, undefined, 'preparation expires on the next owner cycle');
    assert.equal(c.queue.length, 0);
    assert.equal(api.reactionPaused(c), false);
    cases.push({ scenario, returns: returns.length, consumed: consumed.length, choices: choices.length });
  }
  return { mode, cases, failures: [] };
}
export async function auditDeferredConditions({ mode = 'native' } = {}) {
  const api = await loadAuditRuntime(mode), rows = [];
  const instances = [
    { cardId: 'guardCounter', legacyAbility: true, upgraded: false },
    { cardId: 'guardCounter', legacyAbility: true, upgraded: true },
    { cardId: 'guardCounter', abilityRank: 2, upgraded: false },
    { cardId: 'guardCounter', abilityRank: 5, upgraded: false },
    { cardId: 'progression-crimson-reprisal', abilityRank: 2, upgraded: false },
    { cardId: 'progression-crimson-reprisal', abilityRank: 5, upgraded: false },
  ];
  for (const instance of instances) for (const truth of [false, true]) {
    const { combat: c } = makeAuditCombat(api, { classId: 'reaver', enemyIds: ['wanderingSoldier'], instance, relicIds: [] });
    const card = c.piles.hand[0], def = api.resolveCombatCard(c, card);
    const crimson = instance.cardId === 'progression-crimson-reprisal';
    const condition = crimson ? { p: 'turnMetric', metric: 'hpLostSinceTurnStart', atLeast: 1 } : { p: 'hasBlock', of: 'self' };
    setAuditPredicate(c, condition, truth, c.player);
    const damageEffects = def.effects.filter(e => e.op === (crimson ? 'poiseDamage' : 'damage'));
    assert.ok(damageEffects.every(e => typeof e.amount === 'number'));
    // Independent inputs: mutually exclusive legacy faces, or the unconditional
    // primary plus an earned permanent-grade rider. No counter preview oracle.
    const expected = instance.legacyAbility ? damageEffects[truth ? 1 : 0].amount
      : damageEffects[0].amount + (truth ? damageEffects[1].amount : 0);
    const pool = { stamina: c.player.stamina, mana: c.player.mana }, hp = c.enemies[0].hp, start = c.eventLog.length;
    api.dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: c.player.id });
    settleAuditChoices(api, c);
    const prepared = c.player.combatCounter;
    assert.equal(prepared.payload[crimson ? 'poise' : 'hp'], expected, 'predicate selects the exact retained payload');
    assert.equal(c.enemies[0].hp, hp, 'preparation has no immediate HP hit');
    const receipt = c.eventLog.slice(start).find(e => e.type === 'cardPlayed' && e.cardInstanceId === card.instanceId);
    assert.ok(receipt);
    assert.equal(c.player.stamina, pool.stamina - receipt.staminaSpent);
    assert.equal(c.player.mana, pool.mana - receipt.manaSpent);
    // Supply protection after preparation too: a false hasBlock gate may not
    // become retroactively earned when protection arrives before the attacker.
    c.player.block = 10000;
    const nextTurn = c.turn;
    api.dispatch(c, { type: 'endTurn' });
    settleAuditChoices(api, c);
    const events = c.eventLog.slice(start);
    assert.ok(events.some(e => e.type === 'enemyMoveStarted' && e.enemyId === 'wanderingSoldier' && e.moveId === 'slash'));
    const returned = events.filter(e => e.type === 'combatCounterTriggered' && e.cardInstanceId === card.instanceId);
    assert.equal(returned.length, 1);
    const scale = n => n > 0 ? n + Math.max(Math.floor(n * .75), 1) : n;
    if (crimson) {
      // Current authored counterPayload Poise is Counterstruck; permanent grade
      // rider stays additive, then Impact doubles the retained total.
      const primary = damageEffects[0].amount, extra = truth ? damageEffects[1].amount : 0;
      assert.equal(returned[0].poiseDamage, (scale(primary) + extra) * 2);
      assert.equal(returned[0].amount, 0);
      assert.ok(events.some(e => e.type === 'meterFilled' && e.meter === 'poise' && e.targetId === c.enemies[0].id && e.cardInstanceId === card.instanceId));
      assert.ok(api.getStacks(c.enemies[0], 'staggered') > 0, 'real reply commits the break/status outcome');
    } else {
      assert.equal(returned[0].amount, scale(expected));
      const hits = events.filter(e => e.type === 'damageDealt' && e.cardInstanceId === card.instanceId);
      assert.equal(hits.length, 1);
      assert.equal(hits[0].base, scale(expected));
      assert.equal(c.enemies[0].hp, hp - Math.max(0, hits[0].amount - hits[0].blocked));
    }
    assert.equal(c.player.combatCounter, undefined);
    assert.equal(c.queue.length, 0);
    assert.equal(api.reactionPaused(c), false);
    assert.ok(c.turn > nextTurn);
    rows.push({ instance, condition, truth, prepared: expected, returnHp: returned[0].amount, returnPoise: returned[0].poiseDamage,
      ...(instance.legacyAbility ? { complementaryCondition: { p: 'not', pred: condition } } : {}) });
  }
  return { mode, rows, failures: [] };
}
// Save service covers committed model state; add transient queue and RNG.
// Derived preview caches are intentionally excluded: they are not gameplay state.
export function auditStateSnapshot(api, c) {
  return JSON.stringify({ model: api.serializeCombatSnapshot(c), rng: c.rng.getCounters(),
    queue: c.queue.map(({ source, owner, target, ...action }) => ({ ...action, sourceId: source?.id, ownerId: owner?.id, targetId: target?.id })),
    buffer: c._buffer, pendingExpansionActions: c.pendingExpansionActions });
}
export async function auditRefusals({ mode = 'native' } = {}) {
  const api = await loadAuditRuntime(mode), inventory = auditInventory(api.registries);
  const report = { mode, rejected: [], acceptedEmptyPools: [], failures: [] };
  const variants = inventory.variants.filter(v => !v.instance.upgraded && !v.instance.profileId && !v.instance.legacyAbility && v.upcastTier === undefined && (v.instance.abilityRank === undefined || v.instance.abilityRank === 0));
  for (const variant of variants) for (const scenario of ['wrong-side', 'empty-pools']) {
    const key = `${variant.key}/${scenario}`;
    try {
      const { combat: c } = makeAuditCombat(api, { classId: variant.classId, instance: variant.instance, relicIds: [], scenario: scenario === 'empty-pools' ? scenario : 'baseline' });
      const inst = c.piles.hand[0], def = api.resolveCombatCard(c, inst);
      const plan = api.cardTargetPlan(def, c.player.id, c.enemies, [{ ...c.player, connected: true }], { solo: true });
      const targetId = scenario === 'wrong-side' ? plan.mode === 'enemy' ? c.player.id : c.enemies[0].id : plan.legalIds[0];
      const choice = api.cardChoicePlan(c, inst.instanceId)?.options.find(o => !o.active)?.id;
      const costs = api.cardPlayCosts(c, inst.instanceId);
      const target = targetId === c.player.id ? c.player : c.enemies.find(e => e.id === targetId);
      const activeRestores = (def.effects || []).filter(e => ['gainEnergy', 'restoreStamina', 'restoreMana'].includes(e.op) &&
        (!e.if || api.evalPredicate(c, e.if, { owner: c.player, source: c.player, target })));
      const funded = { stamina: 0, mana: 0 };
      for (const e of activeRestores) funded[e.op === 'restoreMana' ? 'mana' : 'stamina'] += Math.max(0, Number(e.funded) || 0);
      const before = auditStateSnapshot(api, c);
      const start = c.eventLog.length;
      let refusal;
      try { api.dispatch(c, { type: 'playCard', cardInstanceId: inst.instanceId, targetId, ...(choice ? { choice } : {}) }); }
      catch (error) { refusal = error; }
      if (refusal) {
        const reason = refusal.playRefusal?.reason || /^Invalid (enemy|friendly) target /.test(refusal.message) && 'wrong-side';
        const expected = api.registries.framework.isUnplayable(def) ? 'unplayable' : scenario === 'wrong-side' ? 'wrong-side' : 'cost';
        assert.equal(reason, expected, `scenario-specific refusal: ${refusal.message}`);
        assert.equal(auditStateSnapshot(api, c), before, 'rejected play is atomic across committed model, queue and RNG');
        report.rejected.push({ key, reason });
      } else {
        assert.equal(scenario, 'empty-pools', 'wrong-side target must never play');
        for (const pool of ['energy', 'mana', 'stamina']) assert.equal(costs[pool], 0, `net ${pool} payment must be zero`);
        settleAuditChoices(api, c);
        const events = c.eventLog.slice(start), receipts = events.filter(e => e.type === 'cardPlayed' && e.cardInstanceId === inst.instanceId);
        assert.equal(receipts.length, 1);
        for (const [pool, field] of [['energy', 'energySpent'], ['mana', 'manaSpent'], ['stamina', 'staminaSpent']]) assert.equal(receipts[0][field], costs[pool], `actual ${pool} payment`);
        const stamina = events.filter(e => e.type === 'energyGained' || e.type === 'staminaRecovered' && e.targetId === c.player.id).reduce((n, e) => n + e.amount, 0);
        const mana = events.filter(e => e.type === 'manaRestored' && e.targetId === c.player.id).reduce((n, e) => n + e.amount, 0);
        assert.equal(c.player.energy, stamina - receipts[0].energySpent, 'Actions/restoration ledger');
        assert.equal(c.player.stamina, stamina - receipts[0].staminaSpent, 'Stamina/restoration ledger (Actions alias Stamina)');
        assert.equal(c.player.mana, mana - receipts[0].manaSpent, 'Mana/restoration ledger');
        for (const [pool, ops] of [['stamina', ['gainEnergy', 'restoreStamina']], ['mana', ['restoreMana']]]) {
          const effects = activeRestores.filter(e => ops.includes(e.op));
          assert.ok(effects.every(e => typeof e.amount === 'number'), 'restoration requires a numeric authored outcome contract');
          const expected = effects.reduce((n, e) => n + Math.max(0, e.amount - (e.funded || 0)), 0);
          assert.equal(pool === 'mana' ? mana : stamina, expected, `authored active ${pool} restoration less funded price`);
        }
        assert.equal(c.queue.length, 0);
        report.acceptedEmptyPools.push({ key, reason: funded.stamina > 0 || funded.mana > 0 ? 'active resolved restore funds its price' : 'zero effective resource price',
          paid: { stamina: receipts[0].staminaSpent, mana: receipts[0].manaSpent }, funded, restored: { stamina, mana } });
      }
    } catch (error) { report.failures.push({ key, message: error.message }); }
  }
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = process.argv.includes('--deferred-conditions') ? await auditDeferredConditions({ mode: process.argv.includes('--bundled') ? 'bundled' : 'native' }) : process.argv.includes('--refusals') ? await auditRefusals({ mode: process.argv.includes('--bundled') ? 'bundled' : 'native' }) : process.argv.includes('--counter-lifecycle') ? await auditCounterLifecycle({ mode: process.argv.includes('--bundled') ? 'bundled' : 'native' }) : process.argv.includes('--conditions') ? await auditConditionalCards({ mode: process.argv.includes('--bundled') ? 'bundled' : 'native' }) : await auditCards({ mode: process.argv.includes('--bundled') ? 'bundled' : 'native', allEnemies: process.argv.includes('--all-enemies'), allVariants: process.argv.includes('--all-variants') });
  console.log(JSON.stringify(report));
  if (report.failures.length || (report.fixtureGaps?.length || 0)) process.exitCode = 1;
}
