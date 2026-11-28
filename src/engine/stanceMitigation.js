// The profile's directed matchup table also describes a defender winning the
// exchange. This is one multiplicative stage, shared by live damage/previews.
import { TriangleRules } from '../model/stanceTriangle.js';

const canonical = maneuver => ({ casting: 'prepared', cast: 'prepared', ranged: 'attack' })[maneuver] || maneuver;
const NO_MITIGATION = Object.freeze({
  defenseAdvantage: false,
  mitigation: 0,
  multiplier: 1,
});
export function stanceMitigation(ctx, incoming, defending) {
  // The triangle's loser is unchanged: no defender mitigation.
  if (TriangleRules(ctx))
  {
    return { ...NO_MITIGATION };
  }
  const rules = ctx?.gameProfile?.modules?.stances;
  const attack = canonical(incoming), defense = canonical(defending);
  const defenseAdvantage = !!rules?.include?.includes(attack)
    && !!rules?.include?.includes(defense) && !!rules?.matchups?.[defense]?.includes(attack);
  // Missing on an old saved resolved profile preserves that profile's rules;
  // newly resolved profiles inherit the editable module JSON default.
  const mitigation = defenseAdvantage ? rules.defenseMitigation ?? 0 : 0;
  return { defenseAdvantage, mitigation, multiplier: 1 - mitigation };
}
