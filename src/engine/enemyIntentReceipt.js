import * as ActionPreview from './enemyActionPreview.js';
// Public forecasts captured at the event boundary, before the live queue moves
// on. A contact refresh quotes only that contact, never all remaining hits.
import * as Damage from './combatDamagePreview.js';
import * as Tactics from './combatCardTactics.js';
import * as Counter from './counterRule.js';
import * as Actions from './actions.js';
import { evaluate } from '../model/formulas.js';
import { enemyMoveDamage } from '../model/state.js';
import { fixCoreEnabled } from '../model/fixCoreMechanics.js';
import { configuredCombat, profileDamageReceipt } from './gameProfileCombat.js';

export function captureEnemyIntent(ctx, enemy, action = null) {
  // Co-op keeps its existing observer-specific projection; one shared event
  // must not expose another seat's private read or defender state.
  if (ctx.players instanceof Map) return null;
  const moveId = action?.meta?.moveId || enemy.intent?.moveId;
  if (!moveId || !enemy.actorIntentRevealed) return null;
  const authored = ctx.registries.enemies.get(enemy.enemyId)?.moves?.[moveId];
  if (!authored) return null;
  const move = Tactics.expandedEnemyMove(enemy, authored, moveId, ctx);
  const carrier = action?.card || Tactics.enemyMoveCarrier(enemy, authored, moveId, ctx);
  const group = action?.meta?.expansionGroup;
  const sequence = group?.contactSequence;
  const payloadDamage = action?.effect?.op === 'damage';
  const contact = !!sequence && payloadDamage;
  const formulas = payloadDamage ? Actions.formulaCtxFor(ctx, action, ctx.player) : null;
  const hits = payloadDamage ? evaluate(action.effect.hits ?? 1, formulas) * evaluate(action.effect.repeat ?? 1, formulas) : move.hits ?? 1;
  const base = payloadDamage ? evaluate(action.effect.amount ?? 0, formulas) : enemyMoveDamage(enemy, move);
  const out = { kind: move.intent, moveId, profile: { ...carrier.combatProfile }, combatProfile: { ...carrier.combatProfile },
    block: move.block ?? null, delayed: !!move.delay, pending: !!enemy.pendingMove,
    revealed: true, hidden: false, damageScope: contact ? 'contact' : 'action',
    ...(sequence ? { contactIndex: sequence.index, contactCount: sequence.contacts.length } : {}) };
  const payload = group?.enemyMoveStart?.actionPreview || ActionPreview.previewEnemyAction(ctx, enemy, moveId);
  if (payload) { out.actionEffects = payload.actionEffects; out.chargingEffects = payload.chargingEffects; }
  if (carrier.combatProfile?.maneuver === 'counter') {
    out.counterDamage = enemy.combatCounter?.payload?.hp ?? enemy.combatCounter?.damage ?? 0;
    out.counterPoiseDamage = enemy.combatCounter?.payload?.poise ?? enemy.combatCounter?.poiseDamage ?? 0;
    return out;
  }
  if (base == null) return out;
  const state = Damage.damagePreviewState(ctx, ctx.player);
  // Live Core grants a paid Counter's extra Block immediately before its hit.
  // Quote that same grant on the detached defender so the post-response next
  // hit agrees with execution; the live pools and charge remain untouched.
  if (contact && fixCoreEnabled(ctx) && configuredCombat(ctx)) {
    const planned = action.meta?.expansionContacts?.[0]?.[0];
    const receipt = planned && group?.targets?.[planned.key]?.receipt;
    const serial = group?.manualCounterSerials?.[ctx.playerKey || 'player'];
    const paid = serial && serial === receipt?.counter?.serial;
    if (receipt && (!Counter.counterReturnSpent(ctx.player) || paid)) {
      const chance = profileDamageReceipt(ctx, enemy, state.defender, base, carrier);
      const extra = Counter.counterBlockBonus(ctx, receipt, planned.index, chance.damageReceipt?.hits?.[0]?.incoming);
      state.defender.block = (state.defender.block || 0) + Counter.counterBlockGrant(ctx, state.defender, extra);
    }
  }
  const values = Damage.previewDamageHits(ctx, enemy, ctx.player, base, carrier.tags, carrier, hits, state);
  // Executed damage events already retain the full source receipt; forecasts
  // keep only the compact public quantities needed by presentation.
  for (const key of ['damage', 'hits', 'hitDamages', 'totalDamage', 'hpLoss', 'hpLossBounds', 'hitChance', 'uncertain'])
    if (values[key] !== undefined) out[key] = values[key];
  out.damageBasis = fixCoreEnabled(ctx) ? 'hp' : 'beforeBlock';
  return out;
}
