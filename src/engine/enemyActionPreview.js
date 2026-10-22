// Read-only action payloads for the intent and enemy inspector. These are the
// expanded move's opcodes, not phase triggers or an execution on a cloned RNG.
import { evaluate, isFormula } from '../model/formulas.js';
import * as Actions from './actions.js';
import * as Triggers from './triggers.js';
// Reactions can request a captured preview while this module participates in
// Tactics' import cycle. Read its exports when invoked, not during bundling.
import * as Tactics from './combatCardTactics.js';
import { enemyMoveDamage } from '../model/state.js';

export function previewEnemyAction(combat, enemy, moveId) {
  const authored = combat.registries.enemies.get(enemy.enemyId)?.moves?.[moveId];
  if (!authored) return null;
  const move = Tactics.expandedEnemyMove(enemy, authored, moveId, combat);
  const carrier = Tactics.enemyMoveCarrier(enemy, authored, moveId, combat);
  const project = effect => {
    const target = ['self', 'owner'].includes(effect.target) ? enemy : combat.player;
    const action = { source: enemy, owner: enemy, target, card: carrier, meta: { moveId } };
    const formulas = Actions.formulaCtxFor(combat, action, target);
    const resolve = value => isFormula(value) ? evaluate(value, formulas)
      : Array.isArray(value) ? value.map(resolve)
      : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, resolve(entry)])) : value;
    return { ...resolve(effect), ...(effect.if ? { conditionMet: Triggers.evalPredicate(combat, effect.if, action) } : {}) };
  };
  const payload = row => [
    ...(row.damage != null && carrier.combatProfile.maneuver !== 'counter'
      ? [{ op: 'damage', target: 'player', amount: enemyMoveDamage(enemy, row), hits: row.hits ?? 1 }] : []),
    ...(row.block != null && !(row === move && carrier.combatProfile.maneuver === 'counter' && Tactics.enemyCounterDefensePrimed(enemy, moveId)) ? [{ op: 'block', target: 'self', amount: row.block }] : []),
    ...(row.barrier != null && !(row === move && carrier.combatProfile.maneuver === 'counter' && Tactics.enemyCounterDefensePrimed(enemy, moveId)) ? [{ op: 'gainBarrier', target: 'self', amount: row.barrier }] : []),
    ...(row.effects || []).filter(effect => carrier.combatProfile.maneuver !== 'counter'
      || !['damage', 'poiseDamage', ...(combat.combatExpansionVersion === 2 ? ['wardDamage'] : [])].includes(effect.op)),
  ].map(project);
  return { moveId, profile: structuredClone(carrier.combatProfile), tags: [...(carrier.tags || [])],
    actionEffects: payload(move), chargingEffects: move.delay?.whileCharging ? payload(move.delay.whileCharging) : [],
    ...(move.delay ? { delayTurns: move.delay.turns ?? 1 } : {}) };
}
