// The inspector's Precision, Evasion and Crit chance rows (no DOM). Always listed, 0 when absent.
// Crit chance is the engine's own critChance() on the entity's rules (only the player's attacks roll
// one); an attack sums every rule matching its tags (rollCrit), so each rule's tag set is scored against all rules
// and the best is shown.
import { critChance } from '../../engine/actions.js';

export function combatStatRows({ statuses, critRules, attributes, kind }, text) {
  const rules = kind === 'player' && Array.isArray(critRules) ? critRules : [];
  const best = Math.max(0, ...rules.map(rule => critChance(rules, attributes, rule.tags).chance));
  // Enemies never roll crits, so they get no Crit row at all.
  return [
    { label: text('combat.stat.precision'), tipId: 'precision', always: true, value: statuses?.precision?.stacks || 0 },
    { label: text('combat.stat.evasion'), tipId: 'evasion', always: true, value: statuses?.evade?.stacks || 0 },
    ...(kind === 'player' ? [{ label: text('combat.stat.critChance'), tipId: 'critChance', always: true, value: `${Math.round(best * 100)}%` }] : []),
  ];
}
