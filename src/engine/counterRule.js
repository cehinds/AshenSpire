// Core 2 Counter arithmetic (owner ruling 2026-10-19, SPEC §17). One home: the live return, the Block it adds,
// the card face and the target preview all call these, so none of them can drift from the others.
//
// "Incoming damage" is the attack's damage after the attacker's whole chain and its single floor, before Block,
// Barrier, Ward or Poise take anything: the `incoming` figure of the damage receipt (gameProfileCombat.js).
// Pure: no state, no RNG. The fractions are data (content/source/fixCoreMechanics.json `counter`).
import { fixCoreEnabled, fixCoreCounterRules } from '../model/fixCoreMechanics.js';
import { fixCoreRules } from '../model/fixCoreRulesCache.js';
import { configuredModule, armsAsCoreCounter, isSpellCounter, configuredStance, profileDamageReceipt } from './gameProfileCombat.js';
import { previewDamageHits, damagePreviewState } from './combatDamagePreview.js';
// Tactics reaches Counter through Matchups; bundled named imports snapshot
// incomplete exports during that cycle. Read them when the preview runs.
import * as Tactics from './combatCardTactics.js';
import { counterCoversAttack } from './combatReactions.js';
import { rememberCombatStance } from './concurrentStances.js';
import * as statuses from '../framework/statusSemantics.js';
import { counterStackReturn, counterStackCount } from './guardStacks.js';
import { mechanics } from '../framework/data/mechanics.js';

/** True when the Core 2 Counter rule governs this fight. Legacy and co-op profiles keep their own return. */
export const counterRuleActive = ctx => fixCoreEnabled(ctx);

/** True when a Counter stance beats the incoming maneuver in the stances module's matchup table. */
export function counterBeats(ctx, incomingManeuver) {
  return !!incomingManeuver && !!configuredModule(ctx, 'stances')?.matchups?.counter?.includes(incomingManeuver);
}

/**
 * { hp, poise, block } a Counter returns (and adds to its owner's Block) against one hit of `incoming` damage.
 * Owner ruling 2026-10-31 (SPEC §17): the HP return is the Counter's own base damage (`base`, once per answered attack)
 * plus floor(stacks x 10% x incoming); an advantaged hit still adds its flat share of the incoming damage. Poise is the
 * same fraction of that HP as before.
 */
export function counterReturn(ctx, incoming, advantaged, { stacks = 0, base = 0 } = {}) {
  const cfg = fixCoreCounterRules(fixCoreRules(ctx));
  const whole = Math.max(0, Math.floor(Number(incoming) || 0));
  if (!whole) return { hp: 0, poise: 0, block: 0 };
  const hp = Math.max(0, Math.floor(Number(base) || 0)) + counterStackReturn(stacks, whole)
    + (advantaged ? Math.floor(cfg.advantageIncomingFraction * whole) : 0);
  return {
    hp,
    poise: Math.floor((advantaged ? cfg.advantagePoiseFraction : cfg.poiseFraction) * hp),
    block: advantaged ? Math.floor(cfg.advantageBlockFraction * whole) : 0,
  };
}

/** The Counter stacks `entity` would hold after playing a Counter card that leaves it `block` Block (capped). */
export const counterStacksAfterCard = (entity, block) => Math.min(mechanics.counter.stackCap, counterStackCount(entity) + Math.max(0, Math.floor(Number(block) || 0)));

/** The return of an executed action: the sum over the contacts the Counter covered. `base` is the card's own damage, paid on the first. */
export function counterReturnForReceipt(ctx, receipt, { stacks = 0, base = 0 } = {}) {
  const total = { hp: 0, poise: 0, block: 0, incoming: 0, stackShare: 0 };
  let basePaid = false;
  (receipt.covered || []).forEach((covered, index) => {
    if (!covered) return;
    const incoming = receipt.incomings?.[index] ?? receipt.amounts?.[index] ?? 0;
    const row = counterReturn(ctx, incoming, counterBeats(ctx, receipt.profiles?.[index]?.maneuver), { stacks, base: basePaid ? 0 : base });
    if (row.hp > 0 || incoming > 0) basePaid = true;
    total.hp += row.hp; total.poise += row.poise; total.block += row.block;
    total.incoming += Math.max(0, Math.floor(Number(incoming) || 0)); total.stackShare += row.hp > 0 || incoming > 0 ? counterStackReturn(stacks, incoming) : 0;
  });
  return total;
}

/** Automatic returns share the owner-cycle budget; a paid contact has its own serial below. */
export const counterReturnSpent = entity => entity?.combatCounterReturnedCycle === (entity?.combatOwnerCycle || 0);
export const paidCounterContact = (ctx, carrier, counter) => ctx.reactionRules?.contactPolicy === 'perHit'
  && Number.isSafeInteger(carrier?.manualCounterSerial) && carrier.manualCounterSerial === counter?.serial;

/** The part of `amount` Block `entity` can take under its blockCap (Unbreakable): one rule for the live gain and the preview. */
export function counterBlockGrant(ctx, entity, amount) {
  const cap = statuses.getCap(ctx, entity, 'blockCap');
  return cap == null ? amount : Math.max(0, Math.min(amount, cap - (entity.block || 0)));
}

/** The Block a covered, advantaged hit adds to the Counter's owner before it is absorbed (0 otherwise). */
export function counterBlockBonus(ctx, receipt, index, incoming) {
  if (!counterRuleActive(ctx) || !receipt?.counterEligible || receipt.avoided || !receipt.covered?.[index]) return 0;
  if (!counterBeats(ctx, receipt.profiles?.[index]?.maneuver)) return 0;
  return counterReturn(ctx, incoming, true).block;
}

/**
 * What a Counter played now would return against `enemy`'s revealed attack: { incoming, advantaged, hp, poise, block }
 * summed over the attack's hits, or null when no attack damage is public (hidden, unread, or not an attack).
 * `intent` is the observer-gated read (previewIntent) and only decides visibility (its own `damage` is the projected HP loss); the base is the enemy's committed intent, read only once revealed. The attack is
 * priced against a defender standing in Counter stance, as it would land once the Counter is armed.
 */
export function counterPreviewAgainst(ctx, enemy, intent, card = null, projected = null, baseHp = 0) {
  if (!counterRuleActive(ctx) || !enemy?.alive || !intent || intent.hidden || intent.revealed === false || enemy.intent?.damage == null) return null;
  const maneuver = intent.profile?.maneuver;
  if (!maneuver) return null;
  // Only an attack the played Counter covers is answered (the live predicate, not a copy).
  // A revealed attack the Counter does not answer is `{ uncovered: true }`, which is not the same as no read at all.
  if (card && !counterCoversAttack(ctx, card, intent.profile, 'damage')) return { uncovered: true };
  // Live play arms the Counter only when armsAsCoreCounter says so (preparedCounter): a Counter stance, or a spell Counter
  // with coverage (owner 2026-10-19), which arms while standing in the prepared stance it enters.
  if (card && configuredModule(ctx, 'stances') && !armsAsCoreCounter(ctx, card)) return { uncovered: true };
  // The owner already returned a Counter this cycle (two Counters, two enemies, one enemy phase): live returns nothing.
  if (counterReturnSpent(ctx.player) && !(ctx.reactionRules?.contactPolicy === 'perHit' && ctx.phase === 'enemy' && card)) return { uncovered: true, spent: true };
  const move = Tactics.expandedEnemyMove(enemy, ctx.registries.enemies.get(enemy.enemyId).moves[intent.moveId] || {}, intent.moveId, ctx);
  const carrier = Tactics.enemyMoveCarrier(enemy, move, intent.moveId, ctx);
  // `projected` is the player after the card's immediate defensive effects (its Block, the stance-entry grants),
  // run by the preview pipeline on a detached copy, so a Poise break lands exactly when live play lands it.
  const base = projected || ctx.player;
  // A spell Counter stands in the stance it enters (prepared), so the attack is priced against that stance, as live prices it.
  const spell = card && isSpellCounter(card);
  const defender = { ...base, combatStance: spell
    ? { maneuver: configuredStance(card), camp: 'spell', range: card.combatProfile?.range || 'reach' }
    : { maneuver: 'counter', camp: 'physical', range: 'melee' } };
  // Many Forms: live remembers the stance it leaves, so the preview adds the entered one to the retained set rather than replacing it.
  rememberCombatStance(ctx, defender, base.combatStance);
  if (projected) ctx = { ...ctx, player: projected };
  // Hit by hit, as the live exchange resolves them: each advantaged hit grants its Counter Block before it is absorbed,
  // and Poise breaks, Vulnerable and the like carry into later hits.
  const hits = ctx.reactionRules?.contactPolicy === 'perHit' ? 1 : Math.max(1, Math.floor(enemy.intent.hits ?? 1));
  const advantaged = counterBeats(ctx, maneuver);
  const state = damagePreviewState(ctx, defender);
  const total = { hp: 0, poise: 0, block: 0 };
  let incoming = 0;
  // Playing the Counter adds the Block it leaves as stacks first (SPEC §17); an already armed Counter holds what it has.
  const stacks = card ? counterStacksAfterCard(ctx.player, base.block) : counterStackCount(ctx.player);
  for (let hit = 0; hit < hits; hit++) {
    const seen = profileDamageReceipt(state.previewCtx, enemy, state.defender, enemy.intent.damage, carrier).damageReceipt?.hits?.[0]?.incoming ?? 0;
    const row = counterReturn(ctx, seen, advantaged, { stacks, base: hit === 0 ? baseHp : 0 });
    const granted = counterBlockGrant(state.previewCtx, state.defender, row.block);
    state.defender.block = (state.defender.block || 0) + granted;
    previewDamageHits(ctx, enemy, defender, enemy.intent.damage, carrier.tags || [], carrier, 1, state);
    incoming += seen; total.hp += row.hp; total.poise += row.poise; total.block += granted;
  }
  return { incoming, advantaged, hits, stacks, base: baseHp, ...total };
}
