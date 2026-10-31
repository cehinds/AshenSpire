// The inspector's Precision, Evasion and Crit chance rows (no DOM). Always listed, 0 when absent.
// Crit chance is the engine's own critChance() on the entity's rules (only the player's attacks roll
// one); with several rules it is the best any single rule gives.
import { critChance } from '../../engine/actions.js';

export function combatStatRows({ statuses, critRules, attributes, kind }, text) {
  const rules = kind === 'player' && Array.isArray(critRules) ? critRules : [];
  const best = Math.max(0, ...rules.map(rule => critChance([rule], attributes, rule.tags).chance));
  return [
    { label: text('combat.stat.precision'), tipId: 'precision', always: true, value: statuses?.precision?.stacks || 0 },
    { label: text('combat.stat.evasion'), tipId: 'evasion', always: true, value: statuses?.evade?.stacks || 0 },
    { label: text('combat.stat.critChance'), tipId: 'critChance', always: true, value: `${Math.round(best * 100)}%` },
  ];
}
