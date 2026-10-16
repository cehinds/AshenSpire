// The profile's directed matchup table also describes a defender winning the
// exchange. This is one multiplicative stage, shared by live damage/previews.
const canonical = maneuver => ({ casting: 'prepared', cast: 'prepared', ranged: 'attack' })[maneuver] || maneuver;
export function stanceMitigation(ctx, incoming, defending) {
  const rules = ctx?.gameProfile?.modules?.stances;
  const attack = canonical(incoming), defense = canonical(defending);
  const defenseAdvantage = !!rules?.include?.includes(attack)
    && !!rules?.include?.includes(defense) && !!rules?.matchups?.[defense]?.includes(attack);
  // Missing on an old saved resolved profile preserves that profile's rules;
  // newly resolved profiles inherit the editable module JSON default.
  const mitigation = defenseAdvantage ? rules.defenseMitigation ?? 0 : 0;
  return { defenseAdvantage, mitigation, multiplier: 1 - mitigation };
}
