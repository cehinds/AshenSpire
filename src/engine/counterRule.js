// Core 2 Counter arithmetic (owner ruling 2026-10-19, SPEC §17). One home: the live return, the Block it adds,
// the card face and the target preview all call these, so none of them can drift from the others.
//
// "Incoming damage" is the attack's damage after the attacker's whole chain and its single floor, before Block,
// Barrier, Ward or Poise take anything: the `incoming` figure of the damage receipt (gameProfileCombat.js).
// Pure: no state, no RNG. The fractions are data (content/source/fixCoreMechanics.json `counter`).
import { fixCoreEnabled, fixCoreRules, fixCoreCounterRules } from '../model/fixCoreMechanics.js';
import { configuredModule, configuredStance, profileDamageReceipt } from './gameProfileCombat.js';
import { previewDamageHits, damagePreviewState } from './combatDamagePreview.js';
import { enemyMoveCarrier, expandedEnemyMove } from './combatCardTactics.js';
import { counterCoversAttack } from './combatReactions.js';
import * as statuses from '../framework/statusSemantics.js';

/** True when the Core 2 Counter rule governs this fight. Legacy and co-op profiles keep their own return. */
export const counterRuleActive = ctx => fixCoreEnabled(ctx);

/** True when a Counter stance beats the incoming maneuver in the stances module's matchup table. */
export function counterBeats(ctx, incomingManeuver) {
  return !!incomingManeuver && !!configuredModule(ctx, 'stances')?.matchups?.counter?.includes(incomingManeuver);
}

/** { hp, poise, block } a Counter returns (and adds to its owner's Block) against one hit of `incoming` damage. */
export function counterReturn(ctx, incoming, advantaged) {
  const cfg = fixCoreCounterRules(fixCoreRules(ctx));
  const whole = Math.max(0, Math.floor(Number(incoming) || 0));
  const hp = Math.floor(cfg.returnFraction * whole) + (advantaged ? Math.floor(cfg.advantageIncomingFraction * whole) : 0);
  return {
    hp,
    poise: Math.floor((advantaged ? cfg.advantagePoiseFraction : cfg.poiseFraction) * hp),
    block: advantaged ? Math.floor(cfg.advantageBlockFraction * whole) : 0,
  };
}

/** The return of an executed action: the sum over the contacts the Counter covered. */
export function counterReturnForReceipt(ctx, receipt) {
  const total = { hp: 0, poise: 0, block: 0 };
  (receipt.covered || []).forEach((covered, index) => {
    if (!covered) return;
    const incoming = receipt.incomings?.[index] ?? receipt.amounts?.[index] ?? 0;
    const row = counterReturn(ctx, incoming, counterBeats(ctx, receipt.profiles?.[index]?.maneuver));
    total.hp += row.hp; total.poise += row.poise; total.block += row.block;
  });
  return total;
}

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
export function counterPreviewAgainst(ctx, enemy, intent, card = null, projected = null) {
  if (!counterRuleActive(ctx) || !enemy?.alive || !intent || intent.hidden || intent.revealed === false || enemy.intent?.damage == null) return null;
  const maneuver = intent.profile?.maneuver;
  if (!maneuver) return null;
  // Only an attack the played Counter covers is answered (the live predicate, not a copy).
  // A revealed attack the Counter does not answer is `{ uncovered: true }`, which is not the same as no read at all.
  if (card && !counterCoversAttack(ctx, card, intent.profile, 'damage')) return { uncovered: true };
  // Live play arms the Counter only when the card's configured stance is Counter (preparedCounter); a spell Counter
  // stands in the 'prepared' stance there and is never consumed, so the preview promises it no return.
  if (card && configuredModule(ctx, 'stances')) {
    const rule = configuredModule(ctx, 'stances');
    if (!(rule.include?.includes('counter') && configuredStance(card) === 'counter')) return { uncovered: true };
  }
  const move = expandedEnemyMove(enemy, ctx.registries.enemies.get(enemy.enemyId).moves[intent.moveId] || {}, intent.moveId, ctx);
  const carrier = enemyMoveCarrier(enemy, move, intent.moveId, ctx);
  // `projected` is the player after the card's immediate defensive effects (its Block, the stance-entry grants),
  // run by the preview pipeline on a detached copy, so a Poise break lands exactly when live play lands it.
  const base = projected || ctx.player;
  const defender = { ...base, combatStance: { maneuver: 'counter', camp: 'physical', range: 'melee' } };
  delete defender.concurrentStances;
  if (projected) ctx = { ...ctx, player: projected };
  // Hit by hit, as the live exchange resolves them: each advantaged hit grants its Counter Block before it is absorbed,
  // and Poise breaks, Vulnerable and the like carry into later hits.
  const hits = Math.max(1, Math.floor(enemy.intent.hits ?? 1));
  const advantaged = counterBeats(ctx, maneuver);
  const state = damagePreviewState(ctx, defender);
  const total = { hp: 0, poise: 0, block: 0 };
  let incoming = 0;
  for (let hit = 0; hit < hits; hit++) {
    const seen = profileDamageReceipt(state.previewCtx, enemy, state.defender, enemy.intent.damage, carrier).damageReceipt?.hits?.[0]?.incoming ?? 0;
    const row = counterReturn(ctx, seen, advantaged);
    const granted = counterBlockGrant(state.previewCtx, state.defender, row.block);
    state.defender.block = (state.defender.block || 0) + granted;
    previewDamageHits(ctx, enemy, defender, enemy.intent.damage, carrier.tags || [], carrier, 1, state);
    incoming += seen; total.hp += row.hp; total.poise += row.poise; total.block += granted;
  }
  return { incoming, advantaged, hits, ...total };
}
