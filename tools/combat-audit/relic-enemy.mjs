// Bounded audit for mounted relic rules, status lifecycle data and authored
// enemy moves. Run with `node tools/combat-audit/relic-enemy.mjs`.
// Coverage is reported by authored branch; unsupported prerequisites are
// explicit rows and never counted as passes.
import { loadAuditRuntime } from './runtime.mjs';
import { makeAuditCombat, setAuditHand, settleAuditChoices } from './fixtures.mjs';
import { combatStatusRules } from '../../src/content/combatStatusRules.js';
import { execFileSync } from 'node:child_process';

let api = null;

const CARD = 'strike';
const CLASSES = ['reaver', 'starseer', 'herald', 'rogue'];
const MAX_QUEUE = 512;
const MAX_TURNS = 8;

// Select a deterministic, legal hit result without bypassing the combat RNG or
// dispatch path. This only advances the fixture counter to the next favorable
// public attack roll; the engine still resolves accuracy, range and damage.
function primeNextD20Hit(combat) {
  const counters = combat.rng.getCounters();
  const search = api.createRng(combat.rng.seed, counters);
  for (let attempt = 0; attempt < 100; attempt++) {
    const start = search.getCounters().combatAvoidance || 0;
    if (search.int('combatAvoidance', 1, 20) >= 2) {
      combat.rng.restoreCounters({ ...counters, combatAvoidance: start });
      return;
    }
  }
  throw new Error('Could not prime a legal attack hit in the fixture RNG stream');
}

function playerFor(classId, relicIds = [], deckSize = 80) {
  return {
    classId, maxHp: 1000, hp: 700, maxMana: 100, mana: 50,
    maxStamina: 100, stamina: 60, energyMax: 100, drawPerTurn: 5,
    relicIds, deck: Array.from({ length: deckSize }, (_, i) => ({ cardId: CARD, instanceId: `audit-${i}` })),
  };
}

export function drainAuditQueue(combat) {
  let steps = 0;
  while (combat.queue.length) {
    if (++steps > MAX_QUEUE) throw new Error(`Action queue exceeded ${MAX_QUEUE}`);
    api.executeAction(combat, combat.queue.shift());
  }
  return steps;
}

function triggerRows(registries) {
  const rows = [];
  for (const relic of registries.relics.all()) {
    for (const rule of api.relicPropertyRules(registries, relic)) {
      (rule.triggers || []).forEach((trigger, index) => rows.push({ relicId: relic.id, tag: rule.tag, index, trigger }));
    }
  }
  return rows;
}

export function eventPayload(trigger, combat) {
  const player = combat.player;
  const enemy = combat.enemies[0];
  const payload = { sourceId: player.id, targetId: enemy?.id || player.id, amount: 10, blocked: 0, isAttack: true,
    cardId: 'strike', cardType: 'attack', cardTags: ['blade', 'heavy', 'starstone', 'source:spell'], explicit: true, reason: 'effect', status: 'bleed',
    targetStatusesBefore: { bleed: { stacks: 1 } }, keys: ['audit'],
  };
  const set = pred => {
    if (!pred) return;
    if (pred.p === 'all' || pred.p === 'any') return pred.preds.forEach(set);
    if (pred.p === 'not') return set(pred.pred);
    if (pred.p === 'eventSourceIsOwner') payload.sourceId = player.id;
    if (pred.p === 'eventTargetIsOwner') payload.targetId = player.id;
    if (pred.p === 'eventIsAttack') payload.isAttack = true;
    if (pred.p === 'eventStatusIs') payload.status = pred.status;
    if (pred.p === 'cardTypeIs') payload.cardType = pred.type;
    if (pred.p === 'cardTagIs') payload.cardTags = [...new Set([...payload.cardTags, pred.tag])];
    if (pred.p === 'eventDiscardExplicit') { payload.explicit = true; payload.reason = 'effect'; }
    if (pred.p === 'enemyKilledWithStatus') payload.targetStatusesBefore[pred.status] = { stacks: 1 };
    if (pred.p === 'healPositive') payload.amount = 10;
    if (pred.p === 'hpDamagePositive') { payload.amount = 10; payload.blocked = 0; }
    if (pred.p === 'everyNthCardThisCombat') player.counters.cardsPlayedThisCombat = pred.n;
    if (pred.p === 'turnMetric') {
      const riders = player.abilityRiders || (player.abilityRiders = {});
      const m = pred.metric;
      if (m === 'sameCardPlays') riders.sameCardPlays = { [pred.cardId === 'event' ? 'strike' : pred.cardId]: pred.atLeast ?? 0 };
      else if (m === 'distinctTagPlays') riders.distinctTagPlays = { [pred.tag]: Object.fromEntries(Array.from({ length: pred.atLeast || 1 }, (_, i) => [`audit-${i}`, true])) };
      else riders[m] = pred.atLeast ?? 0;
    }
    if (pred.p === 'hasStatus' && pred.of === 'owner') api.applyStatus(combat, player, pred.status, pred.atLeast || 1);
    if (pred.p === 'hasBlock' && pred.of === 'owner') player.block = 1;
  };
  set(trigger.if);
  return payload;
}

function hookEffectResults(combat, hook, owner, eventStart) {
  const events = combat.eventLog.slice(eventStart).filter(event =>
    event.triggeredBy?.kind === 'status' && event.triggeredBy.id === hook.statusId);
  const enemy = combat.enemies[0];
  const effects = hook.do || [];
  const receiptTypes = { applyStatus: 'statusApplied', removeStatus: 'statusRemoved', loseHp: 'hpLost', heal: 'healed',
    block: 'blockGained', gainEnergy: 'energyGained', draw: 'cardDrawn', damage: 'damageDealt', poiseDamage: 'persistentPoiseChanged' };
  return effects.map(effect => {
    const receipts = events.filter(event => event.type === receiptTypes[effect.op]);
    let observed = false;
    if (effect.op === 'applyStatus') {
      const matching = receipts.filter(event => event.status === effect.status);
      observed = matching.length > 0 && matching.every(event => {
        const target = [combat.player, ...combat.enemies].find(entity => entity.id === event.targetId);
        return !!target && api.getStacks(target, effect.status) > 0;
      });
    } else if (effect.op === 'removeStatus') {
      observed = api.getStacks(owner, effect.status) === 0 && receipts.some(event => event.status === effect.status);
    } else if (effect.op === 'block') {
      observed = owner.block > (hook.before.ownerBlock || 0) && receipts.some(event => event.targetId === owner.id && event.amount > 0);
    } else if (effect.op === 'damage') {
      observed = receipts.some(event => event.targetId === enemy?.id && event.amount > 0);
    } else if (effect.op === 'loseHp') {
      observed = owner.hp < hook.before.ownerHp && receipts.some(event => event.targetId === owner.id && event.amount > 0);
    } else if (effect.op === 'heal') {
      observed = owner.hp > hook.before.ownerHp && receipts.some(event => event.targetId === owner.id && event.amount > 0);
    } else if (effect.op === 'draw') {
      observed = combat.piles.hand.length > hook.before.handCount && receipts.length > 0;
    } else if (effect.op === 'gainEnergy') {
      observed = receipts.some(event => event.amount > 0);
    } else if (effect.op === 'poiseDamage') {
      observed = (owner.poiseMeter?.value || 0) !== hook.before.ownerPoise &&
        (receipts.some(event => event.type === 'persistentPoiseChanged' && event.targetId === owner.id) || owner.poiseMeter?.value > 0);
    }
    return { op: effect.op, status: effect.status || null, observed, receiptCount: receipts.length };
  });
}

function falsePredicateCandidates(pred, payload, combat) {
  if (!pred) return [];
  if (pred.p === 'all') return pred.preds.flatMap(child => falsePredicateCandidates(child, payload, combat));
  if (pred.p === 'any') return [pred.preds.flatMap(child => falsePredicateCandidates(child, payload, combat))];
  if (pred.p === 'not') return [truePredicateCandidates(pred.pred, payload, combat)];
  const player = combat.player, enemy = combat.enemies[0];
  const candidate = structuredClone({ payload, player });
  const p = candidate.payload, owner = candidate.player;
  switch (pred.p) {
    case 'eventSourceIsOwner': p.sourceId = enemy.id; break;
    case 'eventTargetIsOwner': p.targetId = enemy.id; break;
    case 'eventIsAttack': p.isAttack = false; break;
    case 'eventStatusIs': p.status = `not-${pred.status}`; break;
    case 'cardTypeIs': p.cardType = `not-${pred.type}`; break;
    case 'cardTagIs': p.cardTags = p.cardTags.filter(tag => tag !== pred.tag); break;
    case 'eventDiscardExplicit': p.explicit = false; break;
    case 'enemyKilledWithStatus': delete p.targetStatusesBefore[pred.status]; break;
    case 'healPositive': case 'hpDamagePositive': case 'manaPositive': p.amount = 0; p.blocked = 0; break;
    case 'everyNthCardThisCombat': owner.counters.cardsPlayedThisCombat = pred.n === 1 ? 0 : 1; break;
    case 'turnMetric': {
      const metric = owner.abilityRiders ||= {};
      const value = Math.max((pred.atMost ?? 0) + 1, (pred.atLeast ?? 0) - 1, 0);
      if (pred.metric === 'sameCardPlays') metric.sameCardPlays = { [pred.cardId === 'event' ? p.cardId : pred.cardId]: value };
      else if (pred.metric === 'distinctTagPlays') metric.distinctTagPlays = { [pred.tag]: {} };
      else metric[pred.metric] = value;
      break;
    }
    case 'hasStatus': delete owner.statuses?.[pred.status]; break;
    case 'hasBlock': owner.block = 0; break;
    case 'firstCardThisTurn': owner.counters.cardsPlayedThisTurn = 1; break;
    case 'firstAttackThisCombat': owner.counters.attacksPlayedThisCombat = 1; break;
    case 'chargeAvailable': delete owner.abilityRiders?.charges?.[pred.key]; break;
    case 'cardAbilityKindIs': p.abilityKind = `not-${pred.kind}`; break;
    case 'cardTargetsAllEnemies': p.cardTargetsAllEnemies = false; break;
    case 'inStance': candidate.player.stanceId = `not-${pred.stance}`; break;
    case 'hpBelowPct': owner.hp = owner.maxHp; break;
    case 'random': return Array.from({ length: 64 }, (_, i) => ({ ...candidate, seed: i + 1 }));
    default: return [];
  }
  return [candidate];
}

function truePredicateCandidates(pred, payload, combat) {
  if (!pred) return [];
  if (pred.p === 'not') return falsePredicateCandidates(pred.pred, payload, combat);
  if (pred.p === 'all' || pred.p === 'any') return pred.preds.flatMap(child => truePredicateCandidates(child, payload, combat));
  const candidate = structuredClone({ payload, player: combat.player });
  const p = candidate.payload, owner = candidate.player;
  if (pred.p === 'random') return Array.from({ length: 64 }, (_, i) => ({ ...candidate, seed: i + 1, forceTrue: true }));
  if (pred.p === 'hasStatus') owner.statuses ||= {}, owner.statuses[pred.status] = { stacks: pred.atLeast ?? 1 };
  else if (pred.p === 'hasBlock') owner.block = 1;
  else if (pred.p === 'inStance') owner.stanceId = pred.stance;
  else if (pred.p === 'hpBelowPct') owner.hp = Math.floor(owner.maxHp * pred.pct / 100);
  else if (pred.p === 'turnMetric') {
    owner.abilityRiders ||= {};
    const amount = pred.atLeast ?? 1;
    if (pred.metric === 'sameCardPlays') owner.abilityRiders.sameCardPlays = { [pred.cardId === 'event' ? p.cardId : pred.cardId]: amount };
    else owner.abilityRiders[pred.metric] = amount;
  } else if (pred.p === 'chargeAvailable') owner.abilityRiders = { charges: { [pred.key]: true } };
  else if (pred.p === 'firstCardThisTurn') owner.counters.cardsPlayedThisTurn = 0;
  else if (pred.p === 'firstAttackThisCombat') owner.counters.attacksPlayedThisCombat = 0;
  else if (pred.p === 'everyNthCardThisCombat') owner.counters.cardsPlayedThisCombat = pred.n;
  else if (pred.p === 'eventSourceIsOwner') p.sourceId = owner.id;
  else if (pred.p === 'eventTargetIsOwner') p.targetId = owner.id;
  else if (pred.p === 'eventIsAttack') p.isAttack = true;
  else if (pred.p === 'eventStatusIs') p.status = pred.status;
  else if (pred.p === 'cardTypeIs') p.cardType = pred.type;
  else if (pred.p === 'cardTagIs') p.cardTags = [...new Set([...p.cardTags, pred.tag])];
  else if (pred.p === 'eventDiscardExplicit') p.explicit = true, p.reason = 'effect';
  else if (pred.p === 'enemyKilledWithStatus') p.targetStatusesBefore[pred.status] = { stacks: 1 };
  else if (pred.p === 'healPositive' || pred.p === 'hpDamagePositive' || pred.p === 'manaPositive') p.amount = 10;
  else if (pred.p === 'cardAbilityKindIs') p.abilityKind = pred.kind;
  else if (pred.p === 'cardTargetsAllEnemies') p.cardTargetsAllEnemies = true;
  else return [];
  return [candidate];
}

function candidatePasses(combat, pred, candidate, event) {
  if (candidate.seed) combat.rng = api.createRng(candidate.seed);
  combat.player = candidate.player;
  return api.evalPredicate(combat, pred, { owner: combat.player, target: combat.enemies[0], event: { type: event, ...candidate.payload } });
}

function effectEvents(combat, relicId, startAt) {
  return combat.eventLog.slice(startAt).filter(event => event.triggeredBy?.kind === 'relic' && event.triggeredBy.id === relicId);
}

export function auditRelics(registries) {
  const branches = triggerRows(registries);
  const rows = [];
  for (const row of branches) {
    const combat = api.createCombat({ registries, rng: api.createRng(7301), enemyIds: ['wanderingSoldier'], player: playerFor('reaver', [row.relicId]) });
    const sourceKey = `property:player:relic:${row.relicId}:${row.index}`;
    // `index` is the stable trigger index for the rule's ordered list.
    const rule = registries.propertyRules.get(row.tag);
    const ruleIndex = (rule.triggers || []).indexOf(row.trigger);
    const key = `property:player:relic:${row.relicId}:${ruleIndex}`;
    const prior = combat.triggerState.get(key)?.fires || 0;
    const event = eventPayload(row.trigger, combat);
    const cursor = combat.eventLog.length;
    const conditionSatisfied = !row.trigger.if || api.evalPredicate(combat, row.trigger.if, { owner: combat.player, target: combat.enemies[0], event: { type: row.trigger.on, ...event } });
    combat.emit(row.trigger.on, event);
    const queued = combat.queue.length;
    drainAuditQueue(combat);
    const fired = (combat.triggerState.get(key)?.fires || 0) > 0;
    const receipts = effectEvents(combat, row.relicId, 0);
    const effectReceipts = receipts.length > 0 || combat.eventLog.some(item => item.type === 'relicTriggered' && item.relicId === row.relicId);
    let gateControl = 'not-applicable';
    if (fired && (row.trigger.once || row.trigger.limitPerTurn != null)) {
      const expected = row.trigger.once ? 1 : Math.min(3, row.trigger.limitPerTurn);
      for (let repeat = 0; repeat < 2; repeat++) {
        combat.emit(row.trigger.on, structuredClone(event));
        drainAuditQueue(combat);
      }
      gateControl = (combat.triggerState.get(key)?.fires || 0) === expected ? 'passed' : `expected-${expected}-got-${combat.triggerState.get(key)?.fires || 0}`;
    }
    const condition = row.trigger.if ? 'satisfied' : 'unconditional';
    let negativeControl = row.trigger.if ? 'unsupported' : 'not-applicable';
    if (row.trigger.if) {
      const candidates = falsePredicateCandidates(row.trigger.if, event, combat).flat();
      for (const candidate of candidates) {
        const control = api.createCombat({ registries, rng: api.createRng(candidate.seed || 7304), enemyIds: ['wanderingSoldier'], player: playerFor('reaver', [row.relicId]) });
        const negativePayload = candidate.payload;
        const trueNow = candidatePasses(control, row.trigger.if, candidate, row.trigger.on);
        if (trueNow) continue;
        control.triggerState.delete(key);
        control.emit(row.trigger.on, negativePayload);
        drainAuditQueue(control);
        negativeControl = (control.triggerState.get(key)?.fires || 0) === 0 ? 'passed' : 'fired-while-false';
        break;
      }
    }
    rows.push({ relicId: row.relicId, tag: row.tag, event: row.trigger.on, index: row.index, condition, conditionSatisfied, fired, queued, effectReceipt: effectReceipts, negativeControl, gateControl,
      once: !!row.trigger.once, limitPerTurn: row.trigger.limitPerTurn ?? null,
      result: fired && effectReceipts && (!row.trigger.if || negativeControl === 'passed') && (gateControl === 'passed' || gateControl === 'not-applicable') ? 'covered' : 'missing',
    });
  }
  const relicCoverage = registries.relics.all().map(relic => {
    const passive = relic.passives || {};
    const rules = api.relicPropertyRules(registries, relic);
    const triggerCount = rules.reduce((sum, rule) => sum + (rule.triggers || []).length, 0);
    return { id: relic.id, propertyRules: rules.length, triggerBranches: triggerCount,
      passiveKeys: Object.keys(passive), authoredNonCombatRole: !rules.length && !triggerCount && !Object.keys(passive).length ? 'no-authored-passive-or-property' : null };
  });
  const passives = auditRelicPassives(registries);
  return { ids: registries.relics.all().length, propertyRelics: relicCoverage.filter(row => row.propertyRules).length,
    branches: branches.length, covered: rows.filter(row => row.result === 'covered').length,
    conditionalBranches: rows.filter(row => row.condition === 'satisfied').length,
    conditionalNegativeControls: rows.filter(row => row.condition === 'satisfied' && row.negativeControl === 'passed').length,
    gatedBranches: rows.filter(row => row.gateControl !== 'not-applicable').length,
    gatedBranchesCovered: rows.filter(row => row.gateControl === 'passed').length,
    passiveIds: passives.ids, passiveDeclarations: passives.effects.length + passives.noOpDeclarations.length,
    passiveEffects: passives.effects.length, passiveEffectRows: passives.effects, passiveEffectsCovered: passives.covered,
    passiveNoOpDeclarations: passives.noOpDeclarations.length, passiveNoOpRows: passives.noOpDeclarations,
    passiveMissing: passives.missing, missing: rows.filter(row => row.result !== 'covered'), relicCoverage, rows };
}

function auditRelicPassives(registries) {
  const ids = registries.relics.all().filter(relic => Object.keys(relic.passives || {}).length);
  const effects = [];
  const noOpDeclarations = [];
  const newRun = relicIds => {
    const run = api.createRunState({ registries, classId: 'reaver', seed: 7306 });
    run.relics = [...relicIds];
    delete run.derivedStatRuleSnapshot;
    api.initializeRunDerivedStats(run, registries, { preserveDeficits: false });
    return run;
  };
  const baseline = newRun([]);
  for (const relic of ids) {
    const own = newRun([relic.id]);
    for (const [key, authored] of Object.entries(relic.passives || {})) {
      if (key === 'modifiers' && Array.isArray(authored) && authored.length === 0) {
        noOpDeclarations.push({ relicId: relic.id, key, authored, result: 'no-op-declaration' });
        continue;
      }
      let expected, observed, result = 'missing';
      if (key === 'modifiers') {
        const receipt = own.derivedStatRuleSnapshot?.relicModifiers;
        const sources = (receipt?.sources || []).filter(row => row.relicId === relic.id);
        const expectedSources = authored.length;
        const hpDelta = own.maxHp - baseline.maxHp, manaDelta = own.maxMana - baseline.maxMana, staminaDelta = own.maxStamina - baseline.maxStamina;
        const hasDamage = authored.filter(row => row.tag === 'damage.school.flat').every(row => receipt?.damageBySchoolAdd?.[row.school] === row.amount);
        expected = { sourceRows: expectedSources, poolDelta: { hp: hpDelta, mana: manaDelta, stamina: staminaDelta } };
        observed = { sourceRows: sources.length, poolDelta: { hp: hpDelta, mana: manaDelta, stamina: staminaDelta }, damageRowsMatch: hasDamage };
        result = sources.length === expectedSources && hasDamage && authored.every(row => row.tag === 'damage.school.flat'
          || row.tag === 'resource.flat' && ((row.resource === 'hp' && hpDelta >= row.amount) || (row.resource === 'mana' && manaDelta >= row.amount) || (row.resource === 'stamina' && staminaDelta >= row.amount))
          || row.tag === 'resource.attributeTier' && sources.some(source => source.resource === row.resource && Number.isFinite(source.value))) ? 'covered' : 'missing';
      } else if (typeof authored === 'boolean') {
        if (key === 'eliteExtraCardReward') {
          const base = api.rollCardRewardIds(registries, api.createRng(7319), { classId: 'reaver', pool: 'elite' });
          const actual = api.rollCardRewardIds(registries, api.createRng(7319), { classId: 'reaver', pool: 'elite', relicIds: [relic.id] });
          expected = base.length + 1; observed = actual.length; result = authored && observed === expected ? 'covered' : 'missing';
        } else if (key === 'revealUnknown') {
          const graph = { nodes: { audit: { id: 'audit', type: 'event', resolved: { kind: 'combat' } } } };
          const base = api.mapKnowledge({ graph, mode: 'path' });
          const actual = api.mapKnowledge({ graph, mode: 'path', reveal: api.passiveFlag(registries, [relic.id], key) });
          expected = { baseline: 'placed', withRelic: 'known' }; observed = { baseline: base.rung.get('audit'), withRelic: actual.rung.get('audit') };
          result = authored && observed.baseline === expected.baseline && observed.withRelic === expected.withRelic ? 'covered' : 'missing';
        } else { expected = authored; observed = null; }
      } else if (typeof authored === 'number') {
        if (key === 'runeGainMult') {
          const base = api.rollRuneReward(registries, api.createRng(7320), 'elite', []);
          const actual = api.rollRuneReward(registries, api.createRng(7320), 'elite', [relic.id]);
          expected = Math.floor(base * authored); observed = actual; result = observed === expected ? 'covered' : 'missing';
        } else if (key === 'restHealMult') {
          const rested = relicIds => {
            const run = newRun(relicIds); run.hp = Math.floor(run.maxHp / 2);
            const visit = api.createLocationVisit({ run, registries, rng: api.createRng(7321) }, 'shrine');
            return api.restAt(visit).heal;
          };
          const base = rested([]), actual = rested([relic.id]);
          expected = { baseline: base, withRelic: Math.ceil(base * authored) }; observed = { baseline: base, withRelic: actual };
          result = actual === expected.withRelic && base > 0 ? 'covered' : 'missing';
        } else if (key === 'flaskPowerMult') {
          const heal = relicIds => {
            const run = newRun(relicIds); run.hp = 1; run.flaskCharges.hpCurrent = 1;
            api.useRunChargeFlask({ run, registries, rng: api.createRng(7322), kind: 'hp' });
            return { amount: run.hp - 1, maxHp: run.maxHp };
          };
          const base = heal([]), actual = heal([relic.id]);
          const expectedRelicHeal = Math.ceil(actual.maxHp * 0.25 * authored);
          expected = { baseline: base.amount, withRelic: expectedRelicHeal }; observed = { baseline: base.amount, withRelic: actual.amount, maxHp: actual.maxHp };
          result = actual.amount === expectedRelicHeal && base.amount > 0 ? 'covered' : 'missing';
        } else if (key === 'powerCostReduction') {
          const cost = relicIds => {
            const combat = makeAuditCombat(api, { classId: 'reaver', enemyIds: ['wanderingSoldier'], seed: 7323, relicIds }).combat;
            setAuditHand(combat, [{ cardId: 'rallyingStandard', instanceId: `power-cost:${relicIds.length}` }]);
            return api.cardPlayCosts(combat, `power-cost:${relicIds.length}`).energy;
          };
          const base = cost([]), actual = cost([relic.id]);
          expected = { baseline: base, withRelic: Math.max(0, base - authored) }; observed = { baseline: base, withRelic: actual };
          result = actual === expected.withRelic && base > 0 ? 'covered' : 'missing';
        } else if (key === 'poiseThresholdAdd') {
          const run = newRun([relic.id]), baseRun = newRun([]);
          const actual = api.playerPoiseThresholdReceipt(registries, run), base = api.playerPoiseThresholdReceipt(registries, baseRun);
          expected = { baseline: base.value, withRelic: base.value + authored };
          observed = { baseline: base.value, withRelic: actual.value, relicContribution: actual.relic };
          result = actual.value === expected.withRelic && actual.relic === authored ? 'covered' : 'missing';
        } else if (key === 'exposureBuildupMult') {
          const exposure = relicIds => {
            const combat = makeAuditCombat(api, { classId: 'starseer', enemyIds: ['wanderingSoldier'], seed: 7325, relicIds }).combat;
            // The default headless runner may freeze the legacy single-meter
            // ruleset. This scenario exercises the configured Arcane Exposure
            // consumer through the canonical card-hit pipeline.
            combat.combatExpansionVersion = 1;
            combat.player.combatExpansionVersion = 1;
            combat.breakMeterVersion = null;
            for (const enemy of combat.enemies) enemy.arcaneExposure = { ...structuredClone(registries.enemies.get(enemy.enemyId).arcaneExposure), value: 0 };
            const cardId = 'starstoneArc', instanceId = `exposure:${relicIds.length}`;
            const cardDef = registries.cards.get(cardId);
            setAuditHand(combat, [{ cardId, instanceId, damageSchool: cardDef.damageSchool, exposureBuildupPerHit: cardDef.exposureBuildupPerHit }]);
            const enemy = combat.enemies[0], before = enemy.arcaneExposure.value;
            api.dispatch(combat, { type: 'playCard', cardInstanceId: instanceId, targetId: enemy.id });
            const after = enemy.arcaneExposure.value;
            const hit = combat.eventLog.find(event => event.type === 'damageDealt' && event.targetId === enemy.id && event.amount > 0);
            return { before, after, hit: hit?.amount || 0, receipts: combat.eventLog.filter(event => event.type === 'arcaneExposureChanged' && event.targetId === enemy.id) };
          };
          const base = exposure([]), actual = exposure([relic.id]);
          const schoolMult = registries.balance.arcaneExposure.schoolBuildupMultipliers.magic;
          const buildupMult = registries.enemies.get('wanderingSoldier').arcaneExposure.buildupMultiplier;
          const amount = Math.floor(registries.cards.get('starstoneArc').exposureBuildupPerHit * schoolMult * buildupMult * authored);
          expected = { baselineIncrease: Math.floor(registries.cards.get('starstoneArc').exposureBuildupPerHit * schoolMult * buildupMult), withRelicIncrease: amount };
          observed = { baselineIncrease: base.after - base.before, withRelicIncrease: actual.after - actual.before, damage: actual.hit, receipts: actual.receipts.length };
          result = observed.baselineIncrease === expected.baselineIncrease && observed.withRelicIncrease === expected.withRelicIncrease
            && actual.hit > 0 && actual.receipts.some(receipt => receipt.amount === amount) ? 'covered' : 'missing';
        } else { expected = authored; observed = null; }
      } else if (key === 'restDenied') {
        const baselineRun = newRun([]), deniedRun = newRun([relic.id]);
        const baselineVisit = api.createLocationVisit({ run: baselineRun, registries, rng: api.createRng(7324) }, 'shrine');
        const deniedVisit = api.createLocationVisit({ run: deniedRun, registries, rng: api.createRng(7324) }, 'shrine');
        let baselineRested = false, denied;
        try { api.restAt(baselineVisit); baselineRested = baselineVisit.rested; } catch {}
        try { api.restAt(deniedVisit); denied = 'rested'; } catch (error) { denied = error.message; }
        expected = { baselineRested: true, deniedBy: relic.id };
        observed = { baselineRested, denied: deniedVisit.restDenied, outcome: denied };
        result = baselineRested && deniedVisit.restDenied === relic.id && denied.includes(`denied by relic '${relic.id}'`) ? 'covered' : 'missing';
      } else { expected = authored; observed = null; }
      effects.push({ relicId: relic.id, key, expected, observed, result });
    }
  }
  return { ids: ids.length, effects, noOpDeclarations, covered: effects.filter(row => row.result === 'covered').length,
    missing: effects.filter(row => row.result !== 'covered') };
}

export function auditStatuses(registries) {
  const rows = [];
  for (const def of registries.statuses.all()) {
    const combat = api.createCombat({ registries, rng: api.createRng(7302), enemyIds: ['wanderingSoldier'], player: playerFor('reaver') });
    const player = combat.player;
    const before = combat.eventLog.length;
    api.applyStatus(combat, player, def.id, 2);
    const applied = api.getStacks(player, def.id) > 0;
    const instance = api.getStatusInstance(player, def.id);
    const stacksBeforeDecay = api.getStacks(player, def.id);
    const durationBeforeDecay = instance?.duration;
    const decay = def.decay;
    if (decay === 'perTurnEnd') api.decayAtTurnEnd(combat, player);
    else if (decay && typeof decay === 'object') api.decayAtTurnEnd(combat, player);
    const afterOneDecay = api.getStatusInstance(player, def.id);
    const decayVerified = decay === 'none' || decay === 'onConsume'
      ? api.getStacks(player, def.id) === stacksBeforeDecay
      : decay === 'perTurnEnd'
        ? api.getStacks(player, def.id) === stacksBeforeDecay - 1
        : !!afterOneDecay && afterOneDecay.duration === durationBeforeDecay - 1;
    let hook = 'none';
    let hookEffectRows = [];
    if (def.hooks?.length) {
      const hookName = def.hooks[0].on;
      const ownerIsEnemy = def.hooks[0].do?.some(effect => effect.op === 'poiseDamage' && effect.target === 'owner');
      const fireHook = targetCombat => {
        const hookOwner = ownerIsEnemy ? targetCombat.enemies[0] : targetCombat.player;
        const hook = def.hooks[0];
        // Leave room in hand so authored draw effects can produce a cardDrawn
        // receipt rather than being masked by the normal hand-size limit.
        if (hook.do?.some(effect => effect.op === 'draw')) targetCombat.piles.hand.length = 0;
        // Predicates and payload construction can mutate fixture state. Build
        // all of that first, then snapshot immediately before dispatching the
        // hook event so setup mutations cannot masquerade as hook outcomes.
        const event = hookName === 'ownerTurnStart' || hookName === 'ownerTurnEnd' ? null : eventPayload(hook, targetCombat);
        if (hookName && event) {
          if (hookName === 'statusApplied') { event.sourceId = hookOwner.id; event.targetId = hookOwner.id; }
          if (hookName === 'cardPlayed') { event.cardType = 'skill'; targetCombat.player.counters.cardsPlayedThisCombat = 3; }
          if (hookName === 'hpLost' || hookName === 'healed') event.targetId = hookOwner.id;
          if (hookName === 'damageDealt') { event.sourceId = targetCombat.player.id; event.targetId = targetCombat.enemies[0]?.id; }
          if (hookName === 'enemyDied' || hookName === 'enemyStaggered') { event.sourceId = targetCombat.player.id; event.targetId = targetCombat.enemies[0]?.id; }
          if (hookName === 'meterFilled') { event.status = 'bleed'; event.targetId = targetCombat.enemies[0]?.id; }
        }
        const before = { ownerHp: hookOwner.hp, ownerBlock: hookOwner.block || 0, ownerPoise: hookOwner.poiseMeter?.value || 0,
          handCount: targetCombat.piles.hand.length, energy: targetCombat.energy };
        const eventStart = targetCombat.eventLog.length;
        if (hookName === 'ownerTurnStart' || hookName === 'ownerTurnEnd') api.fireOwnerHooks(targetCombat, hookOwner, hookName);
        else {
          event.statusId = def.id;
          targetCombat.emit(hookName, event);
        }
        drainAuditQueue(targetCombat);
        const effectRows = hookEffectResults(targetCombat, { ...hook, statusId: def.id, before }, hookOwner, eventStart);
        hookEffectRows = effectRows;
        return effectRows.length > 0 && effectRows.every(row => row.observed);
      };
      hook = fireHook(combat) ? 'fired' : 'no-receipt';
      if (hook === 'no-receipt' && def.hooks[0].if?.p === 'random') {
        for (let seed = 1; seed <= 64 && hook === 'no-receipt'; seed++) {
          const candidate = api.createCombat({ registries, rng: api.createRng(seed), enemyIds: ['wanderingSoldier'], player: playerFor('reaver') });
          api.applyStatus(candidate, ownerIsEnemy ? candidate.enemies[0] : candidate.player, def.id, 2);
          if (fireHook(candidate)) hook = `fired-seed-${seed}`;
        }
      }
    }
    const appliedReceipt = combat.eventLog.slice(before).some(event => event.type === 'statusApplied' && event.status === def.id);
    const modifierOutcomes = Object.entries(def.modifiers || {}).map(([key, expected]) => {
      const readers = [
        ['add', () => api.getAdd(combat, player, key)], ['mult', () => api.getMult(combat, player, key)],
        ['flag', () => api.getFlag(combat, player, key)], ['cap', () => api.getCap(combat, player, key)],
      ];
      const outcome = readers.map(([reader, read]) => ({ reader, value: read() })).find(row =>
        row.reader === 'add' && typeof expected === 'number' && row.value === expected * stacksBeforeDecay
        || row.reader === 'mult' && typeof expected === 'number' && row.value === Math.pow(expected, stacksBeforeDecay)
        || row.reader === 'flag' && expected === true && row.value === true
        || row.reader === 'cap' && typeof expected === 'number' && row.value === expected);
      return { key, expected, outcome: outcome || null };
    });
    const proc = def.proc ? (() => {
      const probe = api.createCombat({ registries, rng: api.createRng(7305), enemyIds: ['wanderingSoldier'], player: playerFor('reaver') });
      const enemy = probe.enemies[0];
      enemy.hp = enemy.maxHp = 1000;
      const threshold = def.proc.threshold;
      api.applyStatus(probe, enemy, def.id, threshold);
      drainProbeQueue(probe);
      const procReceipt = probe.eventLog.find(event => event.type === 'procBurst' && event.status === def.id);
      const effectRows = [
        { op: 'procBurst', observed: !!procReceipt },
        { op: 'loseHp', observed: enemy.hp < enemy.maxHp },
        ...(def.proc.poiseDamage ? [{ op: 'poiseDamage', observed: enemy.poiseMeter?.value > 0 || probe.eventLog.some(event => event.type === 'persistentPoiseChanged' && event.targetId === enemy.id) }] : []),
        ...(def.proc.stagger ? [{ op: 'stagger', observed: probe.eventLog.some(event => event.type === 'enemyStaggered' && event.targetId === enemy.id) }] : []),
        ...(def.proc.effects || []).map(effect => ({ op: effect.op, status: effect.status,
          observed: effect.op === 'applyStatus' ? api.getStacks(enemy, effect.status) >= (effect.stacks || 1) : false })),
        ...(def.proc.resistance ? [{ op: 'resistance', status: def.proc.resistance.status, observed: api.getStacks(enemy, def.proc.resistance.status) > 0 }] : []),
      ];
      const effectObserved = effectRows.every(row => row.observed) && api.getStatusInstance(enemy, def.id)?.meter?.value === 0;
      return { threshold, burst: probe.eventLog.find(event => event.type === 'procBurst' && event.status === def.id) || null,
        effectRows, effectObserved,
        result: effectObserved ? 'covered' : 'missing' };
    })() : null;
    const resistance = def.resists ? (() => {
      const probe = api.createCombat({ registries, rng: api.createRng(7307), enemyIds: ['wanderingSoldier'], player: playerFor('reaver') });
      const target = probe.enemies[0];
      api.applyStatus(probe, target, def.id, 1);
      const meterBefore = api.getStatusInstance(target, def.resists.status)?.meter?.value || 0;
      const receiptStart = probe.eventLog.length;
      const incoming = 3;
      api.applyStatus(probe, target, def.resists.status, incoming);
      const blocked = probe.eventLog.slice(receiptStart).find(event => event.type === 'procResisted' && event.status === def.resists.status);
      const expectedBlocked = Math.ceil(incoming * def.resists.percent / 100);
      const meterAfter = api.getStatusInstance(target, def.resists.status)?.meter?.value || 0;
      const applied = api.getStacks(target, def.resists.status);
      const result = blocked?.blocked === expectedBlocked && meterAfter - meterBefore === incoming - expectedBlocked
        && applied === incoming - expectedBlocked ? 'covered' : 'missing';
      return { status: def.resists.status, expectedPercent: def.resists.percent, incoming, expectedBlocked, meterBefore, meterAfter,
        applied, blocked: blocked?.blocked ?? 0, result };
    })() : null;
    rows.push({ id: def.id, decay: decay === undefined ? 'missing' : decay, hook: def.hooks?.map(x => x.on) || [],
      hasModifier: Object.keys(def.modifiers || {}).length > 0, hasProc: !!def.proc, hasMeter: !!def.meter, hasResist: !!def.resists,
      hasTaggedVulnerability: !!def.taggedVulnerability, applied, appliedReceipt, decayVerified, hookResult: hook,
      hookEffectRows, modifierOutcomes, modifierOutcomesCovered: modifierOutcomes.every(row => row.outcome), proc, resistance,
      result: applied && appliedReceipt && decayVerified && hook !== 'no-receipt' ? 'covered' : 'missing' });
    // Keep this local reference to ensure zero-stack/absent rows don't pass just
    // because their hook or decay was intentionally inert.
    void instance;
  }
  return { ids: registries.statuses.all().length, covered: rows.filter(row => row.result === 'covered').length,
    applyAndDecayCovered: rows.filter(row => row.applied && row.appliedReceipt && row.decayVerified).length,
    modifierDeclarations: rows.reduce((sum, row) => sum + row.modifierOutcomes.length, 0),
    modifierOutcomesCovered: rows.reduce((sum, row) => sum + row.modifierOutcomes.filter(outcome => outcome.outcome).length, 0),
    procBranches: rows.filter(row => row.proc).length,
    procBranchesCovered: rows.filter(row => row.proc?.result === 'covered').length,
    resistanceBranches: rows.filter(row => row.resistance).length,
    resistanceBranchesCovered: rows.filter(row => row.resistance?.result === 'covered').length,
    authoredHooks: rows.filter(row => row.hook.length).length,
    hooksWithObservedOutcome: rows.filter(row => row.hook.length && row.hookResult !== 'no-receipt').length,
    unsupportedEffectPaths: rows.filter(row => row.hook.length && row.hookResult === 'no-receipt').map(row => row.id),
    missing: rows.filter(row => row.result !== 'covered'), rows };
}

function auditSilencedConsumerPaths(registries) {
  const spellCardId = 'cinderSigil';
  const legacyDamage = withStatus => {
    const combat = api.createCombat({ registries, rng: api.createRng(7311), enemyIds: ['wanderingSoldier'], player: playerFor('starseer') });
    const enemy = combat.enemies[0]; enemy.hp = enemy.maxHp = 1000;
    if (withStatus) api.applyStatus(combat, combat.player, 'silenced', 1);
    setAuditHand(combat, [{ cardId: spellCardId, instanceId: `legacy-silenced:${withStatus}` }]);
    api.dispatch(combat, { type: 'playCard', cardInstanceId: `legacy-silenced:${withStatus}`, targetId: enemy.id });
    settleAuditChoices(api, combat);
    return combat.eventLog.filter(event => event.type === 'damageDealt' && event.targetId === enemy.id).map(event => event.amount);
  };
  const legacyBaseline = legacyDamage(false), legacySilenced = legacyDamage(true);

  const expanded = makeAuditCombat(api, { classId: 'starseer', enemyIds: ['wanderingSoldier'], seed: 7312 }).combat;
  setAuditHand(expanded, [{ cardId: spellCardId, instanceId: 'expanded-silenced-cost' }]);
  const costBaseline = api.cardPlayCosts(expanded, 'expanded-silenced-cost');
  api.applyStatus(expanded, expanded.player, 'silenced', 1);
  const costSilenced = api.cardPlayCosts(expanded, 'expanded-silenced-cost');

  const force = makeAuditCombat(api, { classId: 'starseer', enemyIds: ['wanderingSoldier'], seed: 7313 }).combat;
  const enemy = force.enemies[0]; enemy.hp = enemy.maxHp = 1000;
  api.applyStatus(force, enemy, 'silenced', 1);
  setAuditHand(force, [{ cardId: 'starstonePebble', instanceId: 'expanded-silenced-force' }]);
  api.dispatch(force, { type: 'playCard', cardInstanceId: 'expanded-silenced-force', targetId: enemy.id });
  settleAuditChoices(api, force);
  const forceReceipts = force.eventLog.filter(event => event.type === 'damageDealt' && event.targetId === enemy.id);
  const forceSpent = force.eventLog.some(event => event.type === 'statusRemoved' && event.targetId === enemy.id && event.status === 'silenced' && event.reason === 'consumed');
  const forceWard = forceReceipts.some(event => event.forceImmune > 0);
  const rows = [
    { key: 'spellDamageDealtMult', mode: 'legacy spell consumer', cardId: spellCardId, baseline: legacyBaseline,
      observed: legacySilenced, expected: legacyBaseline.map(amount => Math.ceil(amount * 0.5)),
      result: legacyBaseline.length > 0 && legacySilenced.length === legacyBaseline.length
        && legacySilenced.every((amount, index) => amount === Math.ceil(legacyBaseline[index] * 0.5)) ? 'covered' : 'missing' },
    { key: 'spellDamageDealtMult', mode: 'expanded spell surcharge', cardId: spellCardId,
      baseline: costBaseline, observed: costSilenced, expected: { ...costBaseline, energy: costBaseline.energy + 1, stamina: costBaseline.stamina + 1 },
      result: costSilenced.energy === costBaseline.energy + 1 && costSilenced.stamina === costBaseline.stamina + 1
        && costSilenced.mana === costBaseline.mana ? 'covered' : 'missing' },
    { key: 'spellDamageDealtMult', mode: 'expanded Force ward', cardId: 'starstonePebble',
      observed: forceReceipts.map(event => ({ amount: event.amount, forceImmune: event.forceImmune || 0 })), forceSpent, forceWard,
      result: forceSpent && forceWard ? 'covered' : 'missing' },
  ];
  return { normativeContract: 'Legacy spellDamageDealtMultiplier is bypassed in combatExpansionVersion 2; v2 Silenced adds 1 stamina/action cost per stack to spell-camp cards and spends a stack to ward Force contacts (src/engine/actions.js, src/engine/combat.js, SPEC combat profile contract).',
    rows, covered: rows.filter(row => row.result === 'covered').length };
}

function auditStatusModifierConsumers(registries, silencedProof) {
  const rows = [];
  const play = (statusId, cardId, targetStatus = false) => {
    const execute = withStatus => {
      const combat = makeAuditCombat(api, { classId: 'reaver', enemyIds: ['wanderingSoldier'], seed: 7314 }).combat;
      const enemy = combat.enemies[0]; enemy.hp = enemy.maxHp = 10000; enemy.block = 0; enemy.barrier = 0;
      // Fix the fixture at a valid hit without bypassing stance/range/attack
      // resolution. Seed 7314 rolls a 2; Evasion 0 makes the legal melee hit
      // land, so a missing damage packet remains a real consumer failure.
      enemy.evasion = 0;
      primeNextD20Hit(combat);
      if (withStatus) api.applyStatus(combat, targetStatus ? enemy : combat.player, statusId, 1);
      const instanceId = `modifier:${statusId}:${withStatus}`;
      setAuditHand(combat, [{ cardId, instanceId }]);
      api.dispatch(combat, { type: 'playCard', cardInstanceId: instanceId, ...(cardId === 'strike' ? { targetId: enemy.id } : {}) });
      settleAuditChoices(api, combat);
      return cardId === 'strike'
        ? combat.eventLog.filter(event => event.type === 'damageDealt' && event.targetId === enemy.id && event.cardInstanceId === instanceId).map(event => event.incoming)
        : combat.eventLog.filter(event => event.type === 'blockGained' && event.targetId === combat.player.id
          && event.cardInstanceId === instanceId && !event.triggeredBy).map(event => event.amount);
    };
    return { baseline: execute(false), observed: execute(true) };
  };
  const addRow = (statusId, key, check) => rows.push({ statusId, key, ...check, result: check.ok ? 'covered' : 'missing' });
  const scalar = (statusId, key, targetStatus = false) => {
    const expectedValue = registries.statuses.get(statusId).modifiers[key];
    const isTarget = key === 'damageTakenMult';
    const action = play(statusId, 'strike', targetStatus || isTarget);
    const baseline = action.baseline[0], observed = action.observed[0];
    const multiplier = Number(expectedValue);
    const expected = Math.floor(baseline * multiplier);
    return { baseline, observed, expected, ok: Number.isFinite(baseline) && observed === expected };
  };
  for (const id of ['strength']) {
    const row = scalar(id, 'attackDamageAdd');
    const add = registries.statuses.get(id).modifiers.attackDamageAdd;
    row.expected = row.baseline + add;
    row.ok = row.observed === row.expected;
    addRow(id, 'attackDamageAdd', row);
  }
  for (const id of ['weak', 'glassCannon', 'confused', 'slowed']) addRow(id, 'damageDealtMult', scalar(id, 'damageDealtMult'));
  for (const id of ['vulnerable', 'staggered', 'glassCannon', 'entombed']) addRow(id, 'damageTakenMult', scalar(id, 'damageTakenMult', true));
  for (const id of ['dexterity', 'frail', 'slowed']) {
    const value = registries.statuses.get(id).modifiers[id === 'dexterity' ? 'blockAdd' : 'blockGainedMult'];
    const action = play(id, 'defend');
    const baseline = action.baseline.reduce((sum, amount) => sum + amount, 0), observed = action.observed.reduce((sum, amount) => sum + amount, 0);
    const expected = id === 'dexterity' ? baseline + value : Math.floor(baseline * value);
    addRow(id, id === 'dexterity' ? 'blockAdd' : 'blockGainedMult', { baseline, observed, expected, ok: observed === expected });
  }
  for (const id of ['unbreakable', 'unbreakableUp', 'stoneskin']) {
    const execute = withStatus => {
      const combat = makeAuditCombat(api, { classId: 'reaver', enemyIds: ['wanderingSoldier'], seed: 7315 }).combat;
      combat.player.block = 7;
      api.applyStatus(combat, combat.enemies[0], 'entombed', 1); // isolate the next player-turn cleanup from incoming damage
      if (withStatus) api.applyStatus(combat, combat.player, id, 1);
      api.dispatch(combat, { type: 'endTurn' }); settleAuditChoices(api, combat); drainAuditQueue(combat);
      return combat.player.block;
    };
    const baseline = execute(false), observed = execute(true);
    addRow(id, 'retainBlock', { baseline, observed, expected: 7, ok: baseline === 0 && observed === 7 });
  }
  for (const id of ['unbreakable', 'unbreakableUp']) {
    const cap = registries.statuses.get(id).modifiers.blockCap;
    const combat = makeAuditCombat(api, { classId: 'reaver', enemyIds: ['wanderingSoldier'], seed: 7316 }).combat;
    combat.player.block = cap - 1;
    api.applyStatus(combat, combat.player, id, 1);
    setAuditHand(combat, [{ cardId: 'defend', instanceId: `modifier-cap:${id}` }]);
    api.dispatch(combat, { type: 'playCard', cardInstanceId: `modifier-cap:${id}` }); settleAuditChoices(api, combat);
    const observed = combat.player.block;
    addRow(id, 'blockCap', { observed, expected: cap, ok: observed === cap });
  }
  const growth = withStatus => {
    const combat = makeAuditCombat(api, { classId: 'reaver', enemyIds: ['wanderingSoldier'], seed: 7317 }).combat;
    const enemy = combat.enemies[0], before = enemy.poiseMeter.max;
    if (withStatus) api.applyStatus(combat, combat.player, 'goreblood', 1);
    api.growPoiseMeter(combat, enemy);
    return { before, observed: enemy.poiseMeter.max };
  };
  const growthBase = growth(false), growthStatus = growth(true);
  addRow('goreblood', 'meterMaxGrowthDisabled', { baseline: growthBase.observed, observed: growthStatus.observed,
    expected: growthStatus.before, ok: growthBase.observed > growthBase.before && growthStatus.observed === growthStatus.before });
  const skip = withStatus => {
    const combat = makeAuditCombat(api, { classId: 'reaver', enemyIds: ['wanderingSoldier'], seed: 7318 }).combat;
    if (withStatus) api.applyStatus(combat, combat.enemies[0], 'entombed', 1);
    api.dispatch(combat, { type: 'endTurn' }); settleAuditChoices(api, combat);
    return combat.eventLog.some(event => event.type === 'enemyMoveStarted');
  };
  const skippedBaseline = skip(false), skippedStatus = skip(true);
  addRow('entombed', 'skipTurn', { baseline: skippedBaseline, observed: skippedStatus, expected: false,
    ok: skippedBaseline && !skippedStatus });
  const silencedRow = silencedProof.rows.find(row => row.mode === 'legacy spell consumer');
  addRow('silenced', 'spellDamageDealtMult', { baseline: silencedRow.baseline, observed: silencedRow.observed,
    expected: silencedRow.expected, ok: silencedRow.result === 'covered' });
  return { declarations: rows.length, covered: rows.filter(row => row.result === 'covered').length,
    missing: rows.filter(row => row.result !== 'covered'), rows };
}

export function auditStatusControls(registries) {
  const rows = [];
  const controls = Object.entries(combatStatusRules.statuses).filter(([, rule]) => rule.lock)
    .map(([id, rule]) => ({ id, status: rule.activeStatus }));
  controls.push({ id: 'prone', status: combatStatusRules.prone.status });
  for (const row of controls) {
    const { combat } = makeAuditCombat(api, { classId: 'reaver', enemyIds: ['wanderingSoldier'], seed: 7308 });
    api.applyStatus(combat, combat.player, row.status, 1);
    const lockedBefore = api.controlRestrictions(combat, combat.player).locked;
    const controlActiveBefore = row.id === 'prone' ? api.getStacks(combat.player, row.status) > 0 : lockedBefore;
    const selections = api.recoveryControls(combat, combat.player).filter(control => !control.disabled)
      .map(control => ({ status: control.status, stacks: control.stacks }));
    let recovered = false;
    if (selections.length) {
      api.dispatch(combat, { type: 'recoverControl', selections });
      recovered = !api.controlRestrictions(combat, combat.player).locked && api.getStacks(combat.player, row.status) === 0;
    }
    rows.push({ id: row.id, status: row.status, lockedBefore, controls: selections, recovered,
      result: controlActiveBefore && recovered ? 'covered' : 'missing' });
  }
  return { branches: rows.length, covered: rows.filter(row => row.result === 'covered').length, missing: rows.filter(row => row.result !== 'covered'), rows };
}

function auditTaggedVulnerabilities(registries) {
  const rows = [];
  for (const status of registries.statuses.all().filter(def => def.taggedVulnerability)) {
    for (const tag of status.taggedVulnerability.tags) {
      const card = registries.cards.all().find(def => def.tags?.includes(tag) && def.effects?.some(effect => effect.op === 'damage' && effect.target === 'enemy'));
      if (!card) { rows.push({ status: status.id, tag, result: 'missing', reason: 'no authored damage card carries tag' }); continue; }
      const run = withStatus => {
        const { combat } = makeAuditCombat(api, { classId: 'starseer', enemyIds: ['wanderingSoldier'], seed: 7309 });
        const enemy = combat.enemies[0]; enemy.hp = enemy.maxHp = 1000;
        if (withStatus) api.applyStatus(combat, enemy, status.id, 1);
        setAuditHand(combat, [{ cardId: card.id, instanceId: `tagged:${status.id}:${tag}` }]);
        api.dispatch(combat, { type: 'playCard', cardInstanceId: `tagged:${status.id}:${tag}`, targetId: enemy.id });
        settleAuditChoices(api, combat);
        return combat.eventLog.filter(event => event.type === 'damageDealt' && event.targetId === enemy.id).map(event => ({
          amount: event.amount, incoming: event.incoming, blocked: event.blocked || 0,
        }));
      };
      const baseline = run(false), exposed = run(true), mult = status.taggedVulnerability.mult;
      const outcomesMatch = baseline.length > 0 && exposed.length === baseline.length && baseline.every((hit, index) =>
        exposed[index].incoming === Math.ceil(hit.incoming * mult) && exposed[index].blocked === 0);
      rows.push({ status: status.id, tag, cardId: card.id, baseline, exposed,
        expectedMultiplier: mult, result: outcomesMatch ? 'covered' : 'missing' });
    }
  }
  return { branches: rows.length, covered: rows.filter(row => row.result === 'covered').length, missing: rows.filter(row => row.result !== 'covered'), rows };
}

function drainProbeQueue(combat) {
  let steps = 0;
  while (combat.queue.length) {
    if (++steps > MAX_QUEUE) throw new Error(`Status probe queue exceeded ${MAX_QUEUE}`);
    api.executeAction(combat, combat.queue.shift());
  }
}

function passReactions(combat) {
  for (let guard = 0; combat.pendingReaction; guard++) {
    if (guard >= 24) throw new Error('reaction prompts exceeded 24 without settling');
    api.dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  }
}

function enemyMoveRegistry(registries, enemyId, moveId) {
  const enemies = api.contentBundle.enemies.map(enemy => {
    if (enemy.id !== enemyId) return enemy;
    const move = enemy.moves[moveId];
    return { ...enemy, firstMove: moveId, moves: { [moveId]: { ...move, reaction: undefined, weight: 1, locked: false } }, phases: enemy.phases || [] };
  });
  const move = registries.enemies.get(enemyId).moves[moveId];
  const rows = api.contentBundle.enemyMoves.filter(row => row.enemyId !== enemyId).concat({ ...move, id: moveId, enemyId, reaction: undefined, weight: 1, locked: false });
  return api.createRegistries({ ...api.contentBundle, enemies, enemyMoves: rows });
}

export function auditEnemyMoves() {
  const moveRows = [];
  const base = api.createRegistries(api.contentBundle);
  for (const enemyDef of base.enemies.all()) {
    for (const [moveId, move] of Object.entries(enemyDef.moves)) {
      if (move.reaction) continue;
      const registries = enemyMoveRegistry(base, enemyDef.id, moveId);
      const combat = api.createCombat({ registries, rng: api.createRng(7303), enemyIds: [enemyDef.id], player: playerFor('starseer') });
      try {
        const actor = combat.enemies[0];
        actor.hp = Math.max(1, actor.maxHp - 10); // give authored healing a visible prerequisite
        actor.block = 0;
        const cardCountsBefore = Object.fromEntries((move.effects || []).filter(effect => effect.op === 'addCard')
          .map(effect => [effect.card, Object.values(combat.piles).flat().filter(instance => instance.cardId === effect.card).length]));
        const eventStart = combat.eventLog.length;
        for (let turn = 0; turn < MAX_TURNS && !combat.result; turn++) {
          api.dispatch(combat, { type: 'endTurn' });
          passReactions(combat);
          if (combat.turn >= MAX_TURNS) break;
        }
        const started = combat.eventLog.some(event => event.type === 'enemyMoveStarted' && event.moveId === moveId)
          || combat.eventLog.some(event => event.type === 'enemyMoveCharged' && event.moveId === moveId);
        const settled = !combat.pendingReaction && combat.queue.length === 0
          && (combat.phase === 'player' || (combat.phase === 'ended' && ['victory', 'defeat'].includes(combat.result)));
        if (move.counterDamage && combat.phase === 'player' && !combat.result) {
          const counterCard = `audit-counter-probe:${enemyDef.id}:${moveId}`;
          const counterTestCard = move.tags?.includes('counter:spell') ? 'cinderSigil' : 'strike';
          setAuditHand(combat, [{ cardId: counterTestCard, instanceId: counterCard }]);
          api.dispatch(combat, { type: 'playCard', cardInstanceId: counterCard, targetId: actor.id });
          settleAuditChoices(api, combat);
        }
        const moveEvents = combat.eventLog.slice(eventStart).filter(event => event.moveId === moveId);
        const effectRows = [];
        if (move.damage > 0) {
          const contacts = moveEvents.filter(event => event.type === 'damageDealt' && event.targetId === combat.player.id && event.amount > 0);
          effectRows.push({ op: 'damage', expectedContacts: move.hits || 1, observedContacts: contacts.length,
            observed: contacts.length >= (move.hits || 1) });
        }
        if (move.block > 0) {
          const counterArmed = moveEvents.some(event => event.type === 'combatCounterArmed' && event.moveId === moveId);
          const counterResolved = combat.eventLog.some(event => event.type === 'combatCounterTriggered' && event.moveId === moveId && event.targetId === combat.player.id && event.amount > 0);
          const counterConsumed = combat.eventLog.some(event => event.type === 'combatCounterConsumed' && event.moveId === moveId && event.targetId === combat.player.id);
          const blockReceipt = combat.eventLog.some(event => event.type === 'blockGained' && event.moveId === moveId && event.targetId === actor.id && event.amount > 0);
          effectRows.push({ op: 'block', counterArmed, counterResolved, counterConsumed, observed: blockReceipt || (move.counterDamage ? counterArmed && counterConsumed && actor.block > 0 : actor.block > 0) });
        }
        for (const effect of move.effects || []) {
          let observed = false;
          if (effect.op === 'applyStatus') {
            const target = effect.target === 'player' ? combat.player : actor;
            const appliedReceipts = combat.eventLog.slice(eventStart).filter(event => event.type === 'statusApplied' && event.status === effect.status
              && event.targetId === target.id && event.stacks > 0);
            const statusReceipt = appliedReceipts.length > 0;
            const pressureReceipt = moveEvents.some(event => event.type === 'statusPressure' && event.status === effect.status && event.targetId === target.id && event.acceptedBuildup > 0)
              || moveEvents.some(event => event.type === 'statusGaugeFilled' && event.status === effect.status && event.targetId === target.id && event.admitted === true);
            observed = statusReceipt || pressureReceipt;
          } else if (effect.op === 'heal') {
            observed = moveEvents.some(event => event.type === 'healed' && event.targetId === actor.id && event.amount > 0)
              && actor.hp > actor.maxHp - 10;
          } else if (effect.op === 'block') {
            observed = moveEvents.some(event => event.type === 'blockGained' && event.targetId === actor.id && event.amount > 0);
          } else if (effect.op === 'addCard') {
            const cardsAfter = Object.values(combat.piles).flat().filter(instance => instance.cardId === effect.card).length;
            observed = cardsAfter > (cardCountsBefore[effect.card] || 0);
          }
          effectRows.push({ op: effect.op, status: effect.status || null, card: effect.card || null, observed });
        }
        if (!effectRows.length && move.delay) effectRows.push({ op: 'delayedMove', observed: moveEvents.some(event => event.type === 'enemyMoveCharged') });
        if (!effectRows.length && !move.delay) effectRows.push({ op: 'moveReceipt', observed: moveEvents.some(event => event.type !== 'enemyMoveStarted') });
        const outcomeVerified = effectRows.every(row => row.observed);
        moveRows.push({ enemyId: enemyDef.id, moveId, reaction: false, started, settled,
          outcomeVerified, effectRows,
          state: { phase: combat.phase, turn: combat.turn, result: combat.result, pendingReaction: !!combat.pendingReaction, queue: combat.queue.length },
          result: started && settled && outcomeVerified ? 'covered' : 'missing' });
      } catch (error) {
        moveRows.push({ enemyId: enemyDef.id, moveId, reaction: false, started: false, settled: false, result: 'missing', error: error.message });
      }
    }
  }
  const reactions = auditEnemyReactionMoves(base);
  return { enemies: base.enemies.all().length, moves: moveRows.length, covered: moveRows.filter(row => row.result === 'covered').length,
    reactionMoves: new Set(reactions.map(row => `${row.enemyId}:${row.moveId}`)).size, reactionCovered: reactions.filter(row => row.result === 'covered').length, reactionRows: reactions,
    missing: moveRows.filter(row => row.result !== 'covered'), rows: moveRows };
}

function auditEnemyReactionMoves(base) {
  const results = [];
  // Exercise the real playerAction window on canonical dispatch: a 9-damage
  // Smash qualifies, while a 6-damage Attack fails minIncoming=8.
  for (const [caseId, cardId, expected] of [['qualifying', 'stomp', true], ['below-threshold', 'strike', false]]) {
    const { combat } = makeAuditCombat(api, { classId: 'reaver', enemyIds: ['gildedKnight'], seed: 7412 });
    api.dispatch(combat, { type: 'endTurn' }); settleAuditChoices(api, combat);
    const instanceId = `reaction:${caseId}`;
    setAuditHand(combat, [{ cardId, instanceId }]);
    api.dispatch(combat, { type: 'playCard', cardInstanceId: instanceId, targetId: combat.enemies[0].id });
    settleAuditChoices(api, combat);
    const receipts = combat.eventLog.filter(event => event.type === 'enemyMoveStarted' && event.reaction && event.moveId === 'gildedGuard');
    const reactionDamage = combat.eventLog.filter(event => event.type === 'damageDealt' && event.moveId === 'gildedGuard' && event.targetId === combat.player.id);
    const reactionBlock = combat.eventLog.filter(event => event.type === 'blockGained' && event.moveId === 'gildedGuard' && event.targetId === combat.enemies[0].id);
    const outcome = expected ? reactionDamage.some(event => event.amount > 0) && reactionBlock.some(event => event.amount > 0)
      : reactionDamage.length === 0 && reactionBlock.length === 0;
    const matched = receipts.length === (expected ? 1 : 0) && outcome && !combat.pendingReaction && !combat.queue.length;
    results.push({ enemyId: 'gildedKnight', moveId: 'gildedGuard', caseId, expected, observed: receipts.length > 0,
      reactionDamage: reactionDamage.map(event => event.amount), reactionBlock: reactionBlock.map(event => event.amount), outcome,
      settled: !combat.pendingReaction && !combat.queue.length, result: matched ? 'covered' : 'missing' });
  }
  // Binding Riposte is a 50% response during the actual playerReaction window.
  // Search deterministic seeds so both outcomes are observed and answer every
  // legal Counter offer rather than leaving a prompt parked in the fixture.
  const originalRegistries = api.registries;
  const duelist = base.enemies.get('courtDuelist');
  const enemies = base.enemies.all().map(enemy => enemy.id === 'courtDuelist' ? { ...enemy, firstMove: 'lunge',
    moves: { lunge: duelist.moves.lunge, bindingRiposte: duelist.moves.bindingRiposte } } : enemy);
  const enemyMoves = api.contentBundle.enemyMoves.filter(row => row.enemyId !== 'courtDuelist')
    .concat({ ...duelist.moves.lunge, id: 'lunge', enemyId: 'courtDuelist' }, { ...duelist.moves.bindingRiposte, id: 'bindingRiposte', enemyId: 'courtDuelist' });
  api.registries = api.createRegistries({ ...api.contentBundle, enemies, enemyMoves });
  const seen = new Map();
  try {
    for (let seed = 1; seed <= 64 && seen.size < 2; seed++) {
      const { combat } = makeAuditCombat(api, { classId: 'reaver', enemyIds: ['courtDuelist'], seed });
      setAuditHand(combat, [{ cardId: 'guardCounter', instanceId: 'audit-counter' }]);
      api.dispatch(combat, { type: 'endTurn' });
      const offer = combat.pendingReaction;
      if (!offer) continue;
      const option = offer.options.find(row => row.play.cardInstanceId === 'audit-counter');
      if (!option) continue;
      const counterBefore = combat.rng.getCounters().enemyReaction || 0;
      api.dispatch(combat, { type: 'chooseReaction', offerId: offer.id, optionId: option.id });
      const counterAfter = combat.rng.getCounters().enemyReaction || 0;
      const chanceRollDraws = counterAfter - counterBefore;
      settleAuditChoices(api, combat);
      const stacked = combat.eventLog.filter(event => event.type === 'combatEnemyReactionStacked' && event.moveId === 'bindingRiposte');
      const started = combat.eventLog.filter(event => event.type === 'enemyMoveStarted' && event.reaction && event.moveId === 'bindingRiposte');
      const reactionDamageEvents = combat.eventLog.filter(event => event.type === 'damageDealt' && event.moveId === 'bindingRiposte'
        && event.targetId === combat.player.id);
      const reactionDamage = reactionDamageEvents.map(event => event.amount);
      const observed = stacked.length === 1 && started.length === 1 && reactionDamage.some(amount => amount > 0) ? true
        : stacked.length === 0 && started.length === 0 && chanceRollDraws === 1 && reactionDamage.length === 0 ? false : null;
      if (observed !== null) seen.set(observed, { seed, observed, chanceRollDraws, stacked: stacked.length, started: started.length,
        settled: !combat.pendingReaction && combat.queue.length === 0,
        reactionDamage, reactionDamageTargetIds: reactionDamageEvents.map(event => event.targetId) });
    }
  } finally { api.registries = originalRegistries; }
  for (const [expected, observation] of [[true, seen.get(true)], [false, seen.get(false)]]) {
    results.push({ enemyId: 'courtDuelist', moveId: 'bindingRiposte', caseId: expected ? 'chance-taken' : 'chance-declined', expected,
      observed: observation?.observed ?? null,
      seed: observation?.seed ?? null, chanceRollDraws: observation?.chanceRollDraws || 0, stacked: observation?.stacked || 0,
      started: observation?.started || 0, reactionDamage: observation?.reactionDamage || [], settled: !!observation?.settled,
      reactionDamageTargetIds: observation?.reactionDamageTargetIds || [],
      result: observation?.settled && observation.chanceRollDraws === 1
        && (expected ? observation.stacked === 1 && observation.started === 1 && observation.reactionDamage.some(amount => amount > 0)
          : observation.stacked === 0 && observation.started === 0) ? 'covered' : 'missing' });
  }
  return results;
}

export function auditEncounterClassMatrix() {
  const registries = api.registries;
  const scenarios = [];
  for (const encounter of registries.encounters.all()) for (const classId of registries.classes.all().map(def => def.id)) {
    try {
      const enemyIds = encounter.enemies;
      const { combat } = makeAuditCombat(api, { classId, enemyIds, seed: 7411 });
      const turnReceipts = [];
      for (let turn = 0; turn < 2 && !combat.result; turn++) {
        api.dispatch(combat, { type: 'endTurn' });
        settleAuditChoices(api, combat);
        turnReceipts.push(combat.eventLog.filter(event => event.type === 'enemyMoveStarted').length);
        if (combat.phase !== 'player' && !(combat.phase === 'ended' && ['victory', 'defeat'].includes(combat.result))) break;
      }
      // Resolve actual active control through the same built-in recovery controls
      // exposed to a player. A lock is a legal prompt, not a stuck combat.
      for (let attempt = 0; attempt < 8 && combat.phase === 'player' && !combat.result; attempt++) {
        const controls = api.recoveryControls(combat, combat.player);
        const selected = controls.filter(control => !control.disabled).map(control => ({ status: control.status, stacks: control.stacks }));
        if (!selected.length || !api.controlRestrictions(combat, combat.player).locked) break;
        api.dispatch(combat, { type: 'recoverControl', selections: selected });
        settleAuditChoices(api, combat);
      }
      const endTurnSettled = !combat.pendingReaction && !combat.pendingAbilityDiscard && combat.queue.length === 0
        && (combat.phase === 'player' || (combat.phase === 'ended' && ['victory', 'defeat'].includes(combat.result)));
      let targetDeaths = 0;
      const targetProbes = [];
      if (endTurnSettled && !combat.result) {
        const alive = combat.enemies.filter(enemy => enemy.alive);
        for (let i = 0; i < alive.length; i++) {
          const enemy = alive[i]; enemy.hp = 1; enemy.block = 0;
          enemy.evasion = 0;
          const instanceId = `audit:${encounter.id}:${classId}:${i}`;
          const hpBefore = enemy.hp;
          primeNextD20Hit(combat);
          setAuditHand(combat, [{ cardId: 'crawlingShot', instanceId }]);
          const probeStart = combat.eventLog.length;
          api.dispatch(combat, { type: 'playCard', cardInstanceId: instanceId, targetId: enemy.id });
          settleAuditChoices(api, combat);
          const probeEvents = combat.eventLog.slice(probeStart);
          const targetPlan = probeEvents.find(event => event.type === 'cardPreparing' && event.cardInstanceId === instanceId && event.targetId === enemy.id);
          const payment = probeEvents.find(event => event.type === 'cardPlayed' && event.cardInstanceId === instanceId && event.targetId === enemy.id
            && event.cardId === 'crawlingShot' && event.energySpent > 0 && event.staminaSpent > 0);
          const hitReceipt = probeEvents.find(event => event.type === 'attackHit' && event.targetId === enemy.id && event.range === 'reach');
          const damageReceipt = probeEvents.find(event => event.type === 'damageDealt' && event.cardInstanceId === instanceId
            && event.targetId === enemy.id && event.amount > 0);
          const paidTargetPlan = !!targetPlan && !!payment;
          const attackResolved = !!hitReceipt && !!damageReceipt;
          const paid = !!payment;
          if (!enemy.alive) targetDeaths++;
          targetProbes.push({ targetId: enemy.id, enemyId: enemy.enemyId, cardId: 'crawlingShot', targetPlan: !!targetPlan,
            paid, energyPaid: payment?.energySpent || 0, staminaPaid: payment?.staminaSpent || 0,
            hitRange: hitReceipt?.range || null, requiredRange: hitReceipt?.requiredRange || null,
            damage: damageReceipt?.amount || 0, hpBefore, hpAfter: enemy.hp, died: !enemy.alive });
          if (!(paidTargetPlan && attackResolved && paid && enemy.hp < hpBefore)) throw new Error(`Encounter probe ${encounter.id}/${classId}/${enemy.id} lacked a paid, ranged target hit`);
          if (combat.result) break;
        }
      }
      const victorySettled = combat.result === 'victory' && combat.phase === 'ended' && !combat.queue.length && !combat.pendingReaction;
      const expectedDeathCount = enemyIds.length;
      const result = endTurnSettled && targetDeaths === expectedDeathCount && victorySettled ? 'covered' : 'missing';
      scenarios.push({ encounterId: encounter.id, classId, enemyCount: enemyIds.length, endTurnSettled, turnReceipts, targetProbes,
        targetDeaths, expectedDeathCount, victory: combat.result, victorySettled, state: { phase: combat.phase, turn: combat.turn, pendingReaction: !!combat.pendingReaction, queue: combat.queue.length }, result });
    } catch (error) {
      scenarios.push({ encounterId: encounter.id, classId, result: 'missing', error: error.message });
    }
  }
  return { encounters: registries.encounters.all().length, classes: registries.classes.all().length, scenarios: scenarios.length,
    covered: scenarios.filter(row => row.result === 'covered').length, missing: scenarios.filter(row => row.result !== 'covered'), rows: scenarios };
}

export async function runRelicEnemyAudit(mode = 'native') {
  api = await loadAuditRuntime(mode);
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const registries = api.registries;
  const relics = auditRelics(registries);
  const statuses = auditStatuses(registries);
  const silencedConsumerPaths = auditSilencedConsumerPaths(registries);
  const statusModifierConsumers = auditStatusModifierConsumers(registries, silencedConsumerPaths);
  const statusControls = auditStatusControls(registries);
  const taggedVulnerabilities = auditTaggedVulnerabilities(registries);
  const enemies = auditEnemyMoves();
  const encounters = auditEncounterClassMatrix();
  return { sourceRevision, loader: mode, counts: { relics: relics.ids, relicPropertyCarriers: relics.propertyRelics, relicRules: relics.branches, relicBranchesCovered: relics.covered,
    relicConditionalFalseControls: relics.conditionalNegativeControls, relicGatedBranches: relics.gatedBranches, relicGatedBranchesCovered: relics.gatedBranchesCovered,
    relicPassives: relics.passiveIds, relicPassiveDeclarations: relics.passiveDeclarations,
    relicPassiveEffects: relics.passiveEffects, relicPassiveEffectsCovered: relics.passiveEffectsCovered,
    relicPassiveNoOpDeclarations: relics.passiveNoOpDeclarations,
    statuses: statuses.ids, statusesCovered: statuses.covered, statusModifierOutcomes: statuses.modifierOutcomesCovered,
    statusModifierDeclarations: statuses.modifierDeclarations, statusProcBranches: statuses.procBranches, statusProcBranchesCovered: statuses.procBranchesCovered,
    statusSilencedConsumerPathsCovered: silencedConsumerPaths.covered,
    statusModifierConsumerDeclarations: statusModifierConsumers.declarations,
    statusModifierConsumerOutcomesCovered: statusModifierConsumers.covered,
    statusResistanceBranches: statuses.resistanceBranches, statusResistanceBranchesCovered: statuses.resistanceBranchesCovered,
    statusControlBranches: statusControls.branches, statusControlBranchesCovered: statusControls.covered,
    statusTaggedVulnerabilityBranches: taggedVulnerabilities.branches, statusTaggedVulnerabilityCovered: taggedVulnerabilities.covered,
    enemies: enemies.enemies, enemyMoves: enemies.moves, enemyMovesCovered: enemies.covered,
    enemyReactionMoves: enemies.reactionMoves, enemyReactionScenariosCovered: enemies.reactionCovered,
    encounters: encounters.encounters, classes: encounters.classes, encounterClassScenarios: encounters.scenarios, encounterClassCovered: encounters.covered },
    relics, statuses, silencedConsumerPaths, statusModifierConsumers, statusControls, taggedVulnerabilities, enemies, encounters };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await runRelicEnemyAudit(process.argv[2] || 'native');
  console.log(JSON.stringify(report, null, 2));
  if (report.relics.missing.length || report.relics.passiveMissing.length || report.statuses.missing.length || report.silencedConsumerPaths.rows.some(row => row.result !== 'covered') || report.statusModifierConsumers.missing.length || report.statusControls.missing.length || report.taggedVulnerabilities.missing.length || report.enemies.missing.length || report.enemies.reactionRows.some(row => row.result !== 'covered') || report.encounters.missing.length) process.exitCode = 1;
}
