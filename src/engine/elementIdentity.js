// Element identity (W25, owner 2026-11-14): every element has a mechanical identity. The numbers live in
// content/source/fixCoreMechanics.json `elements`; this module is the only place the rules are written, and the
// engine reaches it through a few named hooks (each listed at its call site):
//   gameProfileCombat.profileDamageReceipt  ElementReceiptStages / ElementProtectionView / ElementReceiptFinish
//   actions.applyProfileDamage              ApplyElementReceipt (a landed hit)
//   actions.fixCorePoiseBreak               OnPoiseBreak
//   actions damage op                       ElementTargets (fire spread) / ElementChain (lightning)
//   combat turn loop                        ElementTurnStart / ElementTurnEnd
// A fight without `elements` rules (an old save, another profile) never enters any of it: ElementRulesOf is null.
// Random rolls use the `elements` rng stream only, and only when a rule needs a roll, so no other stream shifts.
// Headless: no document, window or timers.
import { ElementRulesOf, ElementOfHit, HitsAllTargets } from '../model/elementIdentityRules.js';
import { StatusCapsLifted } from '../model/fixCoreMechanics.js';
import { actorRangeKey, engagementBand, movedEngagementState } from '../model/combatEngagement.js';
import { BandsActive, SetEnemyRow } from './bandRows.js';
import * as Statuses from './statuses.js';
import * as Actions from './actions.js';

export { ElementRulesOf, ElementOfHit, HitsAllTargets };

const ATTRIBUTE_IDS = Object.freeze(['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence']);
/** An attacker's attribute: a combatant's own `attributes`, else the fight's player attributes. */
export function ElementAttribute(ctx, entity, id) {
  if (!ATTRIBUTE_IDS.includes(id)) return 0;
  const own = entity?.attributes?.[id];
  const value = Number.isFinite(own) ? own : (entity === ctx?.player ? ctx?.attributes?.[id] : 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
const sumAttributes = (ctx, entity, ids) => ids.reduce((sum, id) => sum + ElementAttribute(ctx, entity, id), 0);
const stacksOf = (entity, id) => Statuses.getStacks(entity, id);
const defOf = (ctx, entity) => (entity?.kind === 'enemy' && entity.enemyId && ctx?.registries?.enemies?.has?.(entity.enemyId) ? ctx.registries.enemies.get(entity.enemyId) : null);
/** Creature tag read (`undead`, `boss`): the entity's own tags, else its definition's tags and kinds. */
export function ElementHasTag(ctx, entity, tag) {
  const def = defOf(ctx, entity);
  return [entity?.tags, def?.tags, def?.kindIds].some(list => Array.isArray(list) && list.includes(tag)) || (tag === 'boss' && (entity?.isBoss === true || def?.boss === true));
}
const livingOpponents = (ctx, source) => (source?.kind === 'enemy' ? [ctx.player] : ctx.enemies || []).filter(entity => entity?.alive);
/** Spell lanes (W25-BANDS rule 9): with rows, the enemies a hit on `target` can spread to are those in its row; otherwise every living opponent. */
const laneOpponents = (ctx, source, target) => livingOpponents(ctx, source).filter(entity => !(BandsActive(ctx) && target?.kind === 'enemy' && target.row) || entity.row === target.row);
const sameSide = (ctx, entity) => (entity?.kind === 'enemy' ? ctx.enemies || [] : [...(ctx.players ? [...ctx.players.values()].map(row => row.entity) : []), ctx.player].filter((e, i, all) => e && all.indexOf(e) === i));

/** A status cap this ruleset lifts: every cap under `statusCaps: "none"` (owner 2026-11-15), Burn's under element rules (owner 2026-11-14; the engine cap is 3); the engine cap otherwise. */
export function ElementStatusCap(ctx, id, engineCap) {
  if (StatusCapsLifted(ctx)) return Infinity;
  const rules = ElementRulesOf(ctx);
  return rules && id === 'burn' && !Number.isFinite(rules.burn.cap) ? Infinity : engineCap;
}
/** Shock's hold cap: none under `statusCaps: "none"`, the element rules' own cap otherwise. */
const burnCap = (ctx, rules) => (!StatusCapsLifted(ctx) && Number.isFinite(rules.burn.cap) ? rules.burn.cap : Infinity);
const shockCap = (ctx, rules) => (StatusCapsLifted(ctx) ? Infinity : rules.shock.cap);
function addCapped(ctx, target, id, stacks, source, cap) {
  if (!target?.alive || !(stacks > 0)) return 0;
  const room = Math.max(0, cap - stacksOf(target, id));
  const add = Math.min(Math.floor(stacks), room);
  if (add > 0) Statuses.applyStatus(ctx, target, id, add, source);
  return add;
}

// ---------------------------------------------------------------------------
// The damage receipt (shown = dealt: every number here is deterministic)
// ---------------------------------------------------------------------------

/** Fire spreads to every living enemy when the card is single-target and more than one enemy stands. */
function fireSpreads(ctx, rules, source, carrier, target = null) {
  if (ElementOfHit(carrier) !== 'fire' || carrier?.elementChain || HitsAllTargets(carrier)) return false;
  // The damage op decides the spread once, before any hit lands, so a spread hit that kills the aimed enemy still
  // costs every other enemy the spread multiplier (shown = dealt).
  if (typeof carrier?.elementSpread === 'boolean') return carrier.elementSpread;
  return !rules.fire.spreadNeedsOtherEnemies || laneOpponents(ctx, source, target).length > 1;
}

/**
 * The damage multipliers of the element rules, in order, as receipt stages. `heal` is what a Necrotic hit restores
 * to an undead target instead of damaging it. Returns { stages: [{ id, label, multiplier }], heal, element }.
 */
export function ElementReceiptStages(ctx, source, target, carrier, raw) {
  const rules = ElementRulesOf(ctx);
  if (!rules) return null;
  const element = ElementOfHit(carrier);
  const stages = [];
  const push = (id, label, multiplier) => { if (Number.isFinite(multiplier) && multiplier !== 1) stages.push({ id, label, multiplier }); };
  push('element-chill', 'Chill: damage dealt', Math.max(0, 1 - rules.frost.chillDamageDealtPerStack * stacksOf(source, 'chill')));
  if (element === 'fire' && fireSpreads(ctx, rules, source, carrier, target)) push('element-fire-spread', BandsActive(ctx) ? 'Fire spreads across its row' : 'Fire spreads to every enemy', rules.fire.spreadMultiplier);
  if (carrier?.elementChain) push('element-chain', 'Lightning chains', rules.lightning.chainMultiplier);
  push('element-burn', 'Burn: damage taken', 1 + rules.burn.damageTakenPerStack * stacksOf(target, 'burn'));
  if (element === 'lightning') push('element-shock', 'Shock: lightning taken', 1 + rules.shock.lightningTakenPerStack * stacksOf(target, 'shock'));
  if (stacksOf(target, 'brittle') > 0) push('element-brittle', 'Brittle', rules.frost.brittleMultiplier);
  const undead = ElementHasTag(ctx, target, rules.necrotic.undeadTag);
  if (element === 'divine' && undead) push('element-divine-undead', 'Divine against the undead', rules.divine.undeadMultiplier);
  let heal = 0;
  if (element === 'necrotic') {
    push('element-necrotic', 'Necrotic', rules.necrotic.damageMultiplier);
    if (undead) {
      let value = Math.max(0, raw);
      for (const stage of stages) value *= stage.multiplier;
      heal = Math.max(0, Math.floor(value));
      stages.push({ id: 'element-necrotic-heals', label: 'Necrotic heals the undead', multiplier: 0 });
    }
  }
  return { stages, heal, element };
}

/**
 * Poise that does not absorb this hit: all of it for Necrotic; WIS + INT points for Fire. Returns
 * { value, ignored } (the pool the hit meets) or null when the pool is untouched.
 */
export function ElementProtectionView(ctx, source, target, carrier) {
  const rules = ElementRulesOf(ctx);
  const pool = target?.persistentPoise;
  if (!rules || !(pool?.value > 0)) return null;
  const element = ElementOfHit(carrier);
  if (element === 'necrotic') return { value: 0, ignored: 0, all: true };
  if (element === 'fire') {
    const ignored = Math.min(pool.value, Math.floor(sumAttributes(ctx, source, rules.fire.poiseIgnoreAttributes) * rules.fire.poiseIgnorePerPoint));
    return ignored > 0 ? { value: pool.value - ignored, ignored } : null;
  }
  return null;
}

/**
 * ForcePoiseShare(ctx, carrier) -> the share of a Force hit's post-Block damage that goes to Poise (`elements.force.poiseShare`, 0.5;
 * owner 2026-11-18: the other half is HP, where a normal physical hit sends 25% to Poise), or null for any other hit.
 */
export function ForcePoiseShare(ctx, carrier) {
  const rules = ElementRulesOf(ctx);
  const share = rules?.force?.poiseShare;
  return rules && Number.isFinite(share) && ElementOfHit(carrier) === 'force' ? Math.min(1, Math.max(0, share)) : null;
}

/**
 * The Poise lost in addition to what absorbed the hit: Fire's ignored points leave the pool (they never absorb, so a fire
 * hit can still break it). Force's Poise rule is a share of the hit, not extra loss: see ForcePoiseShare.
 */
export function ElementReceiptFinish(ctx, carrier, receipt, view, pool) {
  const rules = ElementRulesOf(ctx);
  if (!rules || !receipt) return receipt;
  const element = ElementOfHit(carrier);
  const dealt = (receipt.poiseMitigated || 0) + (receipt.poiseDrain || 0);
  let extra = 0;
  if (view?.ignored > 0) extra += view.ignored;
  const left = Math.max(0, (pool?.value || 0) - (receipt.poiseMitigated || 0) - (receipt.poiseDrain || 0));
  const added = receipt.evaded ? 0 : Math.min(extra, left);
  if (added > 0) receipt.poiseDrain = (receipt.poiseDrain || 0) + added;
  receipt.element = { id: element, heal: receipt.element?.heal || 0, poiseAdded: added, poiseIgnored: view?.ignored || 0, ignoresPoise: !!view?.all };
  return receipt;
}

// ---------------------------------------------------------------------------
// A landed hit
// ---------------------------------------------------------------------------

/**
 * Called by applyProfileDamage once the hit's damage is applied. Records the hit for OnPoiseBreak, then applies what a
 * landed hit of the element does: Necrotic heals the undead or builds up, Divine heals the attacker and cleanses it,
 * Frost chills, and a Brittle target loses Brittle.
 */
export function ApplyElementReceipt(ctx, source, target, receipt, carrier) {
  const rules = ElementRulesOf(ctx);
  if (!rules || !receipt || receipt.evaded) return;
  const element = ElementOfHit(carrier);
  ctx.elementHit = { sourceId: source?.id || null, targetId: target.id, element, amount: receipt.damageReceipt?.hits?.[0]?.incoming ?? receipt.amount, hpLoss: receipt.hpLoss, chain: !!carrier?.elementChain };
  if (stacksOf(target, 'brittle') > 0) Statuses.removeStatus(ctx, target, 'brittle', { reason: 'consumed' });
  if (!element) return;
  if (receipt.element?.heal > 0) Actions.applyHeal(ctx, target, receipt.element.heal);
  // Build-up needs the target's Poise broken (at 0), like the other elemental statuses; the damage itself ignores Poise.
  if (element === 'necrotic' && target.alive && !(target.persistentPoise?.value > 0) && !ElementHasTag(ctx, target, rules.necrotic.undeadTag)) {
    const stacks = Math.max(rules.necrotic.buildupMin, ElementAttribute(ctx, source, rules.necrotic.buildupAttribute));
    Statuses.applyStatus(ctx, target, 'necroticBuildup', stacks, source);
  }
  if (element === 'divine' && source?.alive) {
    const wis = ElementAttribute(ctx, source, rules.divine.healAttribute);
    if (wis > 0) Actions.applyHeal(ctx, source, wis);
    const cleanse = ElementAttribute(ctx, source, rules.divine.cleanseAttribute);
    for (const id of ['necroticBuildup', 'shock']) if (cleanse > 0 && stacksOf(source, id) > 0) Statuses.removeStatus(ctx, source, id, { amount: cleanse, reason: 'consumed' });
  }
  if (element === 'frost' && target.alive) {
    const stacks = rules.frost.chillBase + Math.floor(ElementAttribute(ctx, source, 'intelligence') / rules.frost.chillIntPerExtra);
    Statuses.applyStatus(ctx, target, 'chill', stacks, source);
  }
  // Force no longer pushes by itself (owner, 2026-11-18); only a card that says pull still pulls. A push is the Retreat tag's moveEngagement.
  if (element === 'force' && target.alive && !carrier?.elementChain && cardPulls(carrier)) ElementPushPull(ctx, source, target, carrier);
}

const cardPulls = carrier => (carrier?.cardTags || carrier?.tags || []).map(tag => (typeof tag === 'string' ? tag : tag?.id)).some(tag => tag === 'pull' || tag === 'force:pull');

/** Force: a hit that lands moves the pair one band apart (melee to reach), or together when the card says pull (reach to melee). */
export function ElementPushPull(ctx, source, target, carrier) {
  if (!ctx.rangeState?.policy?.enabled || !source || !target) return;
  const sourceKey = actorRangeKey(ctx, source), targetKey = actorRangeKey(ctx, target);
  if (!sourceKey || !targetKey) return;
  const pull = (carrier?.cardTags || carrier?.tags || []).map(tag => (typeof tag === 'string' ? tag : tag?.id)).some(tag => tag === 'pull' || tag === 'force:pull');
  const band = engagementBand(ctx.rangeState, sourceKey, targetKey);
  if (pull ? band === 1 : band === 0) {
    ctx.rangeState = movedEngagementState(ctx.rangeState, sourceKey, targetKey, pull ? -1 : 1);
    ctx.emit?.('combatEngagementMoved', { sourceId: source.id, targetId: target.id, bands: pull ? -1 : 1, reason: 'force' });
  }
  // Rows (W25-BANDS rule 6): a push sends a front enemy to the back row, a pull brings a back enemy to the front. The row move sets its own pair bands.
  if (BandsActive(ctx) && target.kind === 'enemy' && target.alive) SetEnemyRow(ctx, target, pull ? 'front' : 'back', 'force');
}

/**
 * A Poise break of `target` by `attacker`. One entry point, so the Poise-break rule can call it too. `hit` is the hit that
 * broke the pool (default: the hit being resolved); with none, nothing happens.
 */
export function OnPoiseBreak(ctx, attacker, target, hit = ctx?.elementHit) {
  const rules = ElementRulesOf(ctx);
  if (!rules || !hit || hit.targetId !== target?.id || !hit.element) return;
  const source = attacker;
  if (hit.element === 'fire') {
    const stacks = Math.max(rules.fire.burnMin, ElementAttribute(ctx, source, rules.fire.burnAttribute));
    addCapped(ctx, target, 'burn', stacks, source, burnCap(ctx, rules));
  } else if (hit.element === 'lightning') {
    const stacks = Math.max(...rules.lightning.shockAttributes.map(id => ElementAttribute(ctx, source, id)), 0);
    addCapped(ctx, target, 'shock', stacks, source, shockCap(ctx, rules));
  } else if (hit.element === 'divine') {
    const smite = Math.floor(hit.amount * rules.divine.smiteFraction);
    if (smite > 0) { ctx.emit?.('elementSmite', { sourceId: source?.id || null, targetId: target.id, amount: smite }); Actions.applyLoseHp(ctx, target, smite, 'smite', { sourceId: source?.id }); }
  } else if (hit.element === 'frost') {
    if (stacksOf(target, 'chill') > 0) { Statuses.applyStatus(ctx, target, 'freeze', 1, source); Statuses.applyStatus(ctx, target, 'brittle', 1, source); }
  }
  // Force has no break rider (owner, 2026-11-18): it no longer knocks the target back. Retreat is its own tag.
}

/**
 * The statuses a Poise break of an element adds to the target, applied to a DETACHED copy (a card quote or an enemy intent), so the later hits of
 * the same action are priced against them as live play meets them (Shock raises later lightning damage, Burn all later damage). Mirrors OnPoiseBreak
 * for the statuses only; Smite's HP, Knockback and the push are not carried. No events, no rng.
 */
export function ElementPreviewBreak(ctx, attacker, defender, element, incoming = 0) {
  const rules = ElementRulesOf(ctx);
  if (!rules || !defender || !element) return 0;
  const add = (id, stacks, cap = Infinity) => {
    const have = defender.statuses?.[id]?.stacks || 0, give = Math.min(Math.floor(stacks), Math.max(0, cap - have));
    if (give > 0) defender.statuses = { ...defender.statuses, [id]: { ...defender.statuses?.[id], stacks: have + give } };
  };
  if (element === 'fire') add('burn', Math.max(rules.fire.burnMin, ElementAttribute(ctx, attacker, rules.fire.burnAttribute)), burnCap(ctx, rules));
  else if (element === 'lightning') add('shock', Math.max(...rules.lightning.shockAttributes.map(id => ElementAttribute(ctx, attacker, id)), 0), shockCap(ctx, rules));
  else if (element === 'frost' && (defender.statuses?.chill?.stacks || 0) > 0) { add('freeze', 1); add('brittle', 1); }
  else if (element === 'divine') return Math.floor((incoming || 0) * rules.divine.smiteFraction);
  return 0;
}

// ---------------------------------------------------------------------------
// Which enemies a hit reaches
// ---------------------------------------------------------------------------

/** Fire: a single-target fire card also hits every other living enemy (each at the spread multiplier, see the receipt). */
export function ElementTargets(ctx, source, eff, carrier, targets) {
  const rules = ElementRulesOf(ctx);
  if (!rules || source?.kind === 'enemy' || ![undefined, null, 'enemy'].includes(eff?.target) || targets.length !== 1) return targets;
  if (!fireSpreads(ctx, rules, source, carrier, targets[0])) return targets;
  return [targets[0], ...laneOpponents(ctx, source, targets[0]).filter(entity => entity !== targets[0])];
}

/** The other enemy a lightning hit on `target` chains to: with rows, one in its own row first; then the next living enemy after it in the fight's order, wrapping. */
export function ElementChainTarget(ctx, source, target) {
  const enemies = ctx.enemies || [];
  const at = enemies.indexOf(target);
  const lane = BandsActive(ctx) && target?.row;
  let any = null;
  for (let step = 1; step < enemies.length; step++) {
    const other = enemies[(at + step) % enemies.length];
    if (other === target || !other.alive) continue;
    if (!lane || other.row === lane) return other;
    any ||= other;
  }
  return any;
}

/** The secondary hits a hit plans (deterministic), for the damage op and for previews: [{ kind, target, carrier }]. */
export function ElementSecondaryPlan(ctx, source, target, carrier, { single = true } = {}) {
  const rules = ElementRulesOf(ctx);
  if (!rules || source?.kind === 'enemy' || carrier?.elementChain || !single || ElementOfHit(carrier) !== 'lightning' || HitsAllTargets(carrier)) return [];
  const other = ElementChainTarget(ctx, source, target);
  // The chained hit gets its own contact: the copy keeps the planned contact's flags (no roll of its own) but has its own receipt, so what the
  // chained hit records there (blockBefore, read by the first target's Poise riders) never overwrites the first target's.
  const contact = carrier?.expansionContact && { ...carrier.expansionContact, receipt: carrier.expansionContact.receipt && { ...carrier.expansionContact.receipt } };
  return other ? [{ kind: 'chain', target: other, carrier: { ...carrier, elementChain: true, ...(contact ? { expansionContact: contact } : {}) } }] : [];
}

/** After a landed lightning hit on a single target: the chained hit, dealt through `deal` (the same door as the first). */
export function ElementChain(ctx, source, target, carrier, deal, landed) {
  if (!landed) return;
  for (const row of ElementSecondaryPlan(ctx, source, target, carrier)) deal(source, row.target, row.carrier);
}

// ---------------------------------------------------------------------------
// Turns
// ---------------------------------------------------------------------------

/** One roll on the `elements` stream: true with `pct` percent. Draws nothing for 0. */
const rolls = (ctx, pct) => pct > 0 && ctx.rng.chance('elements', Math.min(100, pct));
function loseAction(ctx, entity, cause, playerLoss) {
  if (entity.kind === 'enemy') entity.skipNextTurn = true;
  else entity.pendingActionLoss = (entity.pendingActionLoss || 0) + playerLoss;
  ctx.emit?.('elementActionLost', { targetId: entity.id, cause });
}

/**
 * At the start of an owner's turn, before its statuses decay: Burn may explode, Chill takes Stamina, Freeze and Shock may take
 * the action. Enemies lose an action by skipping their next turn; the player starts with less Stamina.
 */
export function ElementTurnStart(ctx, entity) {
  const rules = ElementRulesOf(ctx);
  if (!rules || !entity?.alive) return;
  const burn = stacksOf(entity, 'burn');
  if (burn > 0 && rolls(ctx, burn * rules.burn.explodeChancePerStack)) {
    ctx.emit?.('elementBurnExploded', { targetId: entity.id, amount: burn });
    for (const ally of sameSide(ctx, entity)) if (ally !== entity && ally.alive) Actions.applyLoseHp(ctx, ally, burn, 'burn explosion');
    Statuses.removeStatus(ctx, entity, 'burn', { reason: 'consumed' });
  }
  const chill = stacksOf(entity, 'chill'), chillLoss = Math.floor(chill / rules.frost.chillStacksPerStaminaLoss);
  if (chillLoss > 0) {
    if (entity.kind === 'enemy') entity.pendingStaminaLoss = (entity.pendingStaminaLoss || 0) + chillLoss;
    else entity.pendingActionLoss = (entity.pendingActionLoss || 0) + chillLoss;
  }
  if (stacksOf(entity, 'freeze') > 0) {
    Statuses.removeStatus(ctx, entity, 'freeze', { reason: 'consumed' });
    loseAction(ctx, entity, 'freeze', rules.frost.freezePlayerStaminaLoss);
  }
  const shock = stacksOf(entity, 'shock');
  if (shock > 0 && rolls(ctx, shock * rules.shock.actionLossChancePerStack)) loseAction(ctx, entity, 'shock', rules.shock.playerStaminaLoss);
}

/** At the end of an owner's turn: Necrotic build-up at or above current HP kills it Knockback ends. */
export function ElementTurnEnd(ctx, entity) {
  const rules = ElementRulesOf(ctx);
  if (!rules || !entity?.alive) return;
  if (entity.statuses?.knockback) Statuses.removeStatus(ctx, entity, 'knockback', { reason: 'consumed' });
  const buildup = stacksOf(entity, 'necroticBuildup');
  if (!(buildup > 0)) return;
  // Build-up at or above current HP kills any target, bosses included (owner, 2026-11-14: "Bosses die too").
  if (buildup >= entity.hp) {
    ctx.emit?.('elementNecroticDeath', { targetId: entity.id, amount: buildup });
    Actions.applyLoseHp(ctx, entity, entity.hp, 'necrotic build-up');
  }
}
