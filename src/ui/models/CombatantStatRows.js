// The inspector's Precision, Evasion and Crit chance rows (no DOM). Always listed, 0 when absent.
// Crit chance is the engine's own critChance() on the entity's rules (only the player's attacks roll
// one); an attack sums every rule matching its tags (rollCrit), so each rule's tag set is scored against all rules
// and the best is shown.
import { critChance } from '../../engine/actions.js';
import { effectiveD20Percent } from '../../engine/d20Chance.js';

export function combatStatRows({ statuses, critRules, attributes, kind, evade, attackTagSets }, text) {
  // Foundation fights keep dodge charges on entity.evade, not in statuses; the status stacks win when present.
  const evasion = statuses?.evade?.stacks || (Number.isFinite(evade) ? evade : 0);
  const rules = kind === 'player' && Array.isArray(critRules) ? critRules : [];
  // An attack sums every rule matching its own tags (rollCrit), so with the owned attack cards' tag sets
  // known the row is the best of those; without them each rule's own tag set stands in for an attack.
  const known = Array.isArray(attackTagSets) && attackTagSets.length ? attackTagSets : rules.map(rule => rule.tags);
  const best = Math.max(0, ...known.map(tags => critChance(rules, attributes, tags).chance));
  // Enemies never roll crits, so they get no Crit row at all.
  return [
    { label: text('combat.stat.precision'), tipId: 'precision', always: true, value: statuses?.precision?.stacks || 0 },
    { label: text('combat.stat.evasion'), tipId: 'evasion', always: true, value: evasion },
    ...(kind === 'player' ? [{ label: text('combat.stat.critChance'), tipId: 'critChance', always: true, value: `${effectiveD20Percent(best * 100)}%` }] : []),
  ];
}
