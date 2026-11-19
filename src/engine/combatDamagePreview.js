import { BREAK_STATUS_IDS } from './brokenRule.js';
import { fixCoreEnabled, damageReceipt, fixCoreStaggeredRules, fixCoreStaggeredStance, FixCoreBrokenRules } from '../model/fixCoreMechanics.js';
import { fixCorePierceRules } from '../model/fixCoreMechanics.js';
import { fixCoreRules } from '../model/fixCoreRulesCache.js';
import * as ProfileCombat from './gameProfileCombat.js';
import * as Actions from './actions.js';
// Receipt capture enters this shared module from multiple bundled engine
// roots. Read cyclic engine exports when invoked, never during initialization.
import * as Matchups from './combatMatchups.js';
import * as Counter from './counterRule.js';
import { EvadeSpendPlan } from './stanceHit.js';
import { reconcileWardBlock } from '../model/blockPresentation.js';
import { reflectReturned } from './guardStacks.js';
import * as Blight from './ashenBlight.js';
import { ElementPreviewBreak } from './elementIdentity.js';
import { fixCoreWardDisabled } from '../model/fixCoreMechanics.js';
import { DefendPoiseFloor, HeldStance } from './stanceBenefits.js';
import { reviveTokenFor, reviveHp, adjustCount } from '../model/consumables.js';

/**
 * Detached defender state shared by every damage effect in one previewed
 * action. A Counter charge, Guard break, Ward drain, or once-per-action rider
 * spent by an earlier effect must stay spent for the effects that follow.
 */
export function damagePreviewState(ctx, target) {
  const defender = target ? { ...target,
    persistentWard: target.persistentWard && { ...target.persistentWard },
    persistentPoise: target.persistentPoise && { ...target.persistentPoise },
    ...(target.combatCounter ? { combatCounter: structuredClone(target.combatCounter) } : {}) } : null;
  const previewCtx = { ...ctx,
    ...(ctx.player === target ? { player: defender } : {}),
    ...(ctx.playerIdForEntity ? { playerIdForEntity: entity => ctx.playerIdForEntity(entity === defender ? target : entity) } : {}),
  };
  return { defender, previewCtx, targetKey: ctx.playerIdForEntity?.(target) || target?.id,
    combatRiderTargets: [] };
}

/**
 * PreviewStateSnapshot(state) / PreviewStateRestore(state, snapshot): copy the detached defender (and the riders spent) and put it back in place,
 * so a card row that is priced but does not run leaves the later rows' timeline as it was. The defender object keeps its identity (the preview
 * context compares against it).
 */
export function PreviewStateSnapshot(state) {
  const d = state?.defender;
  if (!d) return null;
  return { defender: { ...d, statuses: structuredClone(d.statuses || {}),
    persistentWard: d.persistentWard && { ...d.persistentWard }, persistentPoise: d.persistentPoise && { ...d.persistentPoise },
    ...(d.combatCounter ? { combatCounter: structuredClone(d.combatCounter) } : {}),
    ...(d.combatStance ? { combatStance: structuredClone(d.combatStance) } : {}) }, riders: [...state.combatRiderTargets] };
}
export function PreviewStateRestore(state, snapshot) {
  if (!state?.defender || !snapshot) return;
  for (const key of Object.keys(state.defender)) delete state.defender[key];
  Object.assign(state.defender, snapshot.defender);
  state.combatRiderTargets.splice(0, state.combatRiderTargets.length, ...snapshot.riders);
}

/**
 * A Poise break staggers the owner exactly as live play does (D13): same guards, stance and Vulnerable. Detached:
 * only the previewed defender changes, so later hits of the same card see the stance and the Vulnerable multiplier.
 */
function previewPoiseBreak(ctx, defender) {
  // Broken (owner, 2026-11-14): the previewed owner is Broken for its later hits (the multiplier, 1 since 2026-11-18, and the break's statuses).
  const broken = FixCoreBrokenRules(ctx);
  if (broken) {
    defender.broken = { since: ctx.turn || 0, endTurn: (ctx.turn || 0) + 1, preview: true };
    defender.combatStance = { maneuver: 'staggered', camp: 'physical', range: 'melee', staggered: true, broken: true, damageMultiplier: broken.damageMultiplier };
    // The break's statuses (owner, 2026-11-18, `poise.breakStatusStacks`) land before the card's later hits, as BreakCombatant applies them live.
    if (broken.statusStacks > 0) {
      const statuses = { ...defender.statuses };
      for (const id of BREAK_STATUS_IDS) statuses[id] = { ...statuses[id], stacks: (statuses[id]?.stacks || 0) + broken.statusStacks };
      defender.statuses = statuses;
    }
    return;
  }
  const rules = fixCoreStaggeredRules(ctx.fixCoreRules || ctx.gameProfile?.fixCoreRules);
  if (rules.stance) defender.combatStance = fixCoreStaggeredStance(defender, rules);
  if (rules.vulnerableStacks > 0) defender.statuses = { ...defender.statuses, vulnerable: { ...defender.statuses?.vulnerable, stacks: (defender.statuses?.vulnerable?.stacks || 0) + rules.vulnerableStacks } };
}

/**
 * Explicit Poise damage mid-card (a poiseDamage effect, or Ward damage redirected to Poise when Ward is off),
 * mirrored from live play (actions.js poiseDamage / wardDamage -> drainFixCorePoise): whole numbers, capped at the pool,
 * and emptying it breaks Poise before the card's later effects. Operates on the previewed target state only.
 */
export function previewPoiseDrain(ctx, source, state, effect, card, authored) {
  const { defender, previewCtx } = state;
  const poise = defender?.persistentPoise;
  if (!fixCoreEnabled(ctx) || !defender?.alive || !(poise?.value > 0)) return 0;
  const pressure = previewCtx.combatExpansionVersion === 2 ? Matchups.stancePressureMultiplier(previewCtx, source, defender, card, undefined) : 1;
  let amount;
  if (effect.op === 'poiseDamage') {
    const bonus = previewCtx.combatExpansionVersion === 2 ? Blight.ashenBlightMartialPoise(previewCtx, source,
      { cycleKey: String(source?.combatOwnerCycle || 0), camp: card?.combatProfile?.camp, authoredPoise: authored }) : 0;
    amount = Math.ceil((authored + bonus) * Matchups.matchupPoiseMultiplier(previewCtx, source, defender, card) * pressure);
  } else if (effect.op === 'wardDamage' && fixCoreWardDisabled(ctx)) {
    amount = authored * pressure
      * (!card?.combatWardEdgeApplied && card?.combatProfile?.camp === 'spell' && card?.combatProfile?.damageType === 'piercing' ? 1.25 : 1);
  } else return 0;
  // Live poiseDamage and Ward-off wardDamage carry their card into drainFixCorePoise, so the card's Defend floor applies here too, and no card reads as physical
  // (theme B, 2026-11-17).
  const keep = Math.min(poise.value, DefendPoiseFloor(ctx, defender, card, HeldStance(defender), Math.max(defender.block || 0, defender.previewBlockAtHit || 0)));
  const spent = Math.min(poise.value - keep, Math.max(0, Math.floor(amount * ProfileCombat.SpellPoiseMultiplier(ProfileCombat.configuredModule(ctx, 'effects'), source, defender, card))));
  if (!(spent > 0)) return 0;
  poise.value -= spent;
  if (poise.value === 0) previewPoiseBreak(ctx, defender);
  return spent;
}

/**
 * Carries one resolved hit's effect on the previewed target to its next hit: Block, Barrier, Ward, Poise (absorbed plus a Smash's
 * Poise damage) and, when that empties Poise, the Staggered stance and Vulnerable. Shared by the card preview and the intent projection.
 */
export function applyReceiptToPreviewTarget(ctx, defender, receipt, attacker = null) {
  // The Block held when this hit arrived, for a Poise rider that follows it (live: the tactical receipt's blockBefore). Preview copy only.
  defender.previewBlockAtHit = defender.block || 0;
  defender.block = receipt.blockRemaining;
  if (defender.earthBlock) defender.earthBlock = Math.min(defender.earthBlock, defender.block);
  // Stone Skin spent against this hit's Pierce reaches the next hit of the same card, as live does (actions.js applyProfileDamage).
  if (receipt.skinSpent > 0) {
    const skin = fixCorePierceRules(fixCoreRules(ctx, defender)).skinStatus, held = skin && defender.statuses?.[skin];
    // The detached copy shares its statuses with the real target, so the change is made on a copy.
    if (held) { const left = held.stacks - receipt.skinSpent, next = { ...defender.statuses }; if (left > 0) next[skin] = { ...held, stacks: left }; else delete next[skin]; defender.statuses = next; }
  }
  if (!fixCoreEnabled(ctx)) return;
  if (defender.persistentWard) defender.persistentWard.value = Math.max(0, defender.persistentWard.value - receipt.wardMitigated);
  if (defender.persistentPoise) {
    const poiseBefore = defender.persistentPoise.value;
    defender.persistentPoise.value = Math.max(0, poiseBefore - receipt.poiseMitigated - (receipt.poiseDrain || 0) + (receipt.poiseSpared || 0));
    if (poiseBefore > 0 && defender.persistentPoise.value === 0) {
      previewPoiseBreak(ctx, defender);
      // Shown = dealt: a divine hit that breaks Poise also Smites (live: elementIdentity OnPoiseBreak), so the quoted HP carries it.
      if (!receipt.evaded) receipt.hpLoss += ElementPreviewBreak(ctx, attacker, defender, receipt.element?.id, receipt.damageReceipt?.hits?.[0]?.incoming ?? receipt.amount) || 0;
    }
  }
}

/** A detached copy of an attacker whose HP and defenses a previewed reflected return may spend. */
export function cloneDetachedAttacker(entity) {
  return entity && { ...entity, persistentWard: entity.persistentWard && { ...entity.persistentWard },
    persistentPoise: entity.persistentPoise && { ...entity.persistentPoise } };
}

/**
 * Applies a landed hit's Reflect return to the detached attacker, mirroring actions.js reflectBack (SPEC §17): the return is a
 * flagged reaction hit that needs no hit roll. Returns true when it kills the attacker, so later hits of the same action are
 * forecast as cancelled, as live does. Detached only; no events, no rng.
 */
export function previewReflectReturn(ctx, attacker, holder, receipt, carrier) {
  if (!receipt?.reflect || !attacker || attacker === holder || !(attacker.hp > 0)) return false;
  const amount = reflectReturned(receipt.reflect.original, receipt.reflect.stacks);
  // Live spends Reflect only after Thorns has left a living attacker, including a zero-damage return.
  const left = Math.max(0, (holder.reflectStacks || 0) - 1);
  if (left) holder.reflectStacks = left; else delete holder.reflectStacks;
  if (!(amount > 0)) return false;
  const back = ProfileCombat.profileDamageReceipt(ctx, holder, attacker, amount,
    { ...carrier, combatReaction: true, reflectedHit: true, counterReturnAttack: true, skipRatingBonus: true, proposalReactive: true,
      combatProfile: { ...carrier?.combatProfile, maneuver: 'counter', counterReturnAttack: true }, combatRiderTargets: [] });
  applyReceiptToPreviewTarget(ctx, attacker, { ...back, reflect: null });
  return previewAttackerHpLoss(ctx, attacker, fixCoreEnabled(ctx) ? back.hpLoss : back.amount);
}

function previewAttackerHpLoss(ctx, attacker, amount) {
  attacker.hp -= amount;
  if (attacker.hp > 0) return false;
  // Death prevention, as live afterHpChange (SPEC §14.3): a solo player spends one revive token and rises at its hpPct. Only the
  // detached attacker's own copy of the counts is spent; the live entity and the fight's counts are never touched.
  if (attacker.kind === 'player' && attacker === ctx.player && ctx.consumables) {
    attacker.previewConsumables ||= { ...ctx.consumables };
    const token = reviveTokenFor(ctx.registries, attacker.previewConsumables);
    if (token) {
      adjustCount(attacker.previewConsumables, token.id, -1);
      attacker.hp = reviveHp(attacker.maxHp, token.hpPct);
      return false;
    }
  }
  attacker.hp = 0;
  return true;
}

/** Landed-hit returns follow the live order: Thorns, then Reflect, then a possible Counter. */
export function PreviewHitReturns(ctx, attacker, holder, receipt, carrier) {
  if (!attacker || !(attacker.hp > 0)) return false;
  const thorns = Actions.ThornsDamage(ctx, attacker, holder, carrier, receipt);
  if (thorns > 0 && previewAttackerHpLoss(ctx, attacker, thorns)) return true;
  return previewReflectReturn(ctx, attacker, holder, receipt, carrier);
}

/**
 * A preview context where the detached attacker stands in for `source`: when that is the context's player it becomes
 * `player`, and the seat lookup maps it back to the live entity, so level, attribute and loadout lookups keyed by entity
 * identity (counterReturn levelOf/attributesOf) still resolve while the detached state evolves.
 */
function bindDetachedAttacker(previewCtx, source, attacker) {
  if (!attacker || attacker === source) return previewCtx;
  const lookup = previewCtx.playerIdForEntity;
  return { ...previewCtx,
    ...(source === previewCtx.player ? { player: attacker } : {}),
    ...(lookup ? { playerIdForEntity: entity => lookup(entity === attacker ? source : entity) } : {}) };
}

/**
 * The attacker and context the next contact of `state` is priced from: the detached attacker once a previewed Reflect return
 * has been applied to it (so a broken Poise ends its matching-stance bonus), else `source` itself.
 */
export function previewAttackerView(state, source) {
  const attacker = state.attackerSource === source && state.attacker ? state.attacker : source;
  return { attacker, previewCtx: bindDetachedAttacker(state.previewCtx, source, attacker) };
}

/** A hit avoided by Evade spends what live resolveCertainHit spends (EvadeSpendPlan): the next-attack mode, a prepared charge and one stack,
 *  so a later hit of the same action meets one of each fewer. Detached only: the shared objects are copied, never edited. */
export function SpendPreviewEvade(defender) {
  if (!defender) return;
  const plan = EvadeSpendPlan(defender);
  if (plan.mode) delete defender.nextEvadeMode;
  if (plan.prepared) defender.combatEvade = { ...defender.combatEvade, charges: defender.combatEvade.charges - 1 };
  const evade = defender.statuses?.evade;
  if (plan.stack && evade) defender.statuses = { ...defender.statuses, evade: { ...evade, stacks: evade.stacks - 1 } };
}

/** Pure per-hit threat before Block; only detached tactical defense is spent. */
export function previewDamageHits(ctx, source, target, base, tags, carrier, hits = 1, state = null) {
  const local = state || damagePreviewState(ctx, target);
  const { defender, targetKey } = local;
  const attack = { ...carrier, combatRiderTargets: local.combatRiderTargets };
  if (ProfileCombat.configuredCombat(ctx)) {
    const receipts = [];
    // One detached attacker per preview state, so a Reflect return's damage carries across successive calls (the Counter forecast prices one hit per call).
    if (local.attackerSource !== source) { local.attackerSource = source; local.attacker = cloneDetachedAttacker(source); }
    const attacker = local.attacker;
    const previewCtx = bindDetachedAttacker(local.previewCtx, source, attacker);
    // A target holding a Counter that beats this hit adds Block to itself before the hit is absorbed (SPEC §17), as applyProfileDamage does:
    // the face names the HP the play will cost, so the preview grants that Block too. An intent's own state has already granted it (counterBlocked).
    const counterPlan = defender?.combatCounter && fixCoreEnabled(ctx) && !local.counterBlocked && defender !== source && defender.kind !== source?.kind
      ? Matchups.previewTacticalAction(previewCtx, attacker || source, defender, carrier, Array.from({ length: Math.max(0, Math.floor(hits)) }, () => ({ amount: base }))) : null;
    let counterAnswered = false;
    const poiseStart = defender?.persistentPoise?.value ?? 0;
    for (let hit = 0; hit < Math.max(0, Math.floor(hits)); hit++) {
      if (counterPlan && !counterAnswered && !Counter.counterReturnSpent(defender)) {
        const probe = ProfileCombat.profileDamageReceipt(previewCtx, attacker || source, defender, base, carrier, { forecast: true });
        const bonus = Counter.counterBlockBonus(previewCtx, counterPlan, hit, probe.damageReceipt?.hits?.[0]?.incoming);
        defender.block = (defender.block || 0) + Matchups.CounterBlockGrant(previewCtx, defender, bonus);
        // With a per-hit reaction policy the Counter answers the first covered hit, so it adds Block to that hit only.
        if (bonus > 0 && previewCtx.reactionRules?.contactPolicy === 'perHit') counterAnswered = true;
        // A Counter that answered is used up for whatever acts after this action in the same detached state.
        if (bonus > 0) defender.combatCounter = { ...defender.combatCounter, charges: 0 };
      }
      const receipt = ProfileCombat.profileDamageReceipt(previewCtx, attacker || source, defender, base, carrier, { forecast: true });
      receipts.push(receipt);
      if (defender) { applyReceiptToPreviewTarget(ctx, defender, receipt, attacker || source); if (receipt.evaded) SpendPreviewEvade(defender); }
      // No damage-type rider here: a configured (Core) hit resolves in actions.js applyProfileDamage, which applies no matchup rider, so the
      // only Poise a hit takes is its receipt's (absorbed and drained). Pricing a blunt rider took Poise live never took (fellWarden caneStrike).
      // A Reflect return that kills the attacker cancels its remaining hits (live: the dead source stops the action).
      if (defender && PreviewHitReturns(previewCtx, attacker, defender, receipt, carrier)) break;
    }
    // Owner, 2026-11-14: the quoted hit is the HP the target will lose from it (receipt.hpLoss): after its defensive stance, Reflect, Block,
    // Poise and Evade, carried hit to hit through the detached defender. Supersedes the 2026-11-02 and 2026-11-03 rulings.
    const modern = fixCoreEnabled(ctx);
    const shown = receipt => modern ? receipt.hpLoss : receipt.amount;
    const rawTotal = receipts.reduce((sum, receipt) => sum + shown(receipt), 0);
    return { damageReceipt: damageReceipt(target?.id, receipts.flatMap(row => row.damageReceipt?.hits || [])),
      damage: (receipts[0] && shown(receipts[0])) || 0, hits: receipts.length,
      hitDamages: receipts.map(shown), totalDamage: rawTotal,
      hpLoss: receipts.reduce((sum, receipt) => sum + receipt.hpLoss, 0),
      attackerDead: !!attacker && attacker !== source && !(attacker.hp > 0),
      // Wave 3: the Poise the play removes from this target and whether that breaks it (the target quote's "−6 Poise" / BREAK).
      poiseLoss: modern ? Math.max(0, poiseStart - (defender?.persistentPoise?.value ?? 0)) : 0,
      poiseBreaks: modern && poiseStart > 0 && defender?.persistentPoise?.value === 0,
      hitChance: receipts[0]?.hitChance ?? 1, uncertain: receipts.some(receipt => receipt.uncertain),
      hpLossBounds: modern ? [rawTotal, rawTotal]
        : [receipts.reduce((sum, receipt) => sum + receipt.hpLossBounds[0], 0), receipts.reduce((sum, receipt) => sum + receipt.hpLossBounds[1], 0)] };
  }
  const { previewCtx } = local;
  const rules = Matchups.matchupRules(ctx);
  const hitDamages = [];
  for (let hit = 0; hit < Math.max(0, Math.floor(hits)); hit++) {
    const raw = Actions.computeAttackDamage(previewCtx, source, defender, base, tags, attack, { matchups: false });
    const receipt = Matchups.prepareMatchupHit(previewCtx, source, defender, attack, raw);
    hitDamages.push(receipt.amount);
    if (!defender) continue;
    const blocked = Math.min(Math.max(0, defender.block || 0), Math.max(0, receipt.amount - receipt.guardBypass));
    defender.block = Math.max(0, (defender.block || 0) - blocked);
    reconcileWardBlock(defender);
    if (receipt.counterEligible) delete defender.combatCounter;
    // Typed penetration and synchronous Ward stripping use the same once-per-
    // target budget as execution. Queued statuses/impact do not run in preview.
    const type = rules.damageAliases?.[receipt.profile?.damageType] || receipt.profile?.damageType;
    // Mirrors matchupRiderEffects: damage-type and technique riders share
    // one once-per-target budget, spent when any of them applies.
    const riders = Matchups.hitRiders(rules, type, attack, ctx).filter(row => !row.requiresHpLoss || receipt.amount > blocked);
    if (!attack.combatReaction && receipt.profile && receipt.amount > 0 && riders.length
      && !local.combatRiderTargets.includes(targetKey)) {
      local.combatRiderTargets.push(targetKey);
      // Every rider of a mixed hit drains, as matchupRiderEffects does.
      for (const rider of riders) if (rider.wardDrain > 0) {
        const ward = Math.max(0, Math.min(defender.block, defender.wardBlock || 0));
        const loss = Math.min(ward, rider.wardDrain);
        defender.block -= loss;
        defender.wardBlock = ward - loss;
        defender.wardGuard = Math.max(0, (defender.wardGuard || 0) - (rider.wardDrain - loss));
      }
    }
  }
  return { damage: hitDamages[0] || 0, hits: hitDamages.length,
    hitDamages, totalDamage: hitDamages.reduce((sum, amount) => sum + amount, 0) };
}
