// Per-card explanations for version-two identities; saved legacy vocabulary is unchanged.
export function cardTagExplanation(def, tag) {
  if (def.defenseRulesVersion !== 2) return tag.blurb;
  const evade = def.evade != null;
  if (tag.id === 'maneuver:defend') return evade
    ? 'Evade stance: prepare the printed chance to avoid an incoming attack.'
    : 'Defense stance: grant the printed protection. Spell protection combines physical Block and Ward; DR strengthens Block and PR strengthens Ward.';
  if (tag.id === 'maneuver:sweep')
    return 'Sweep stance: attack across targets. At Rank 2 or higher it can be played as a Reaction before an incoming attack and may interrupt its attacker.';
  if (tag.id === 'maneuver:counter') return evade
    ? 'Evade stance: prepare the printed avoidance. Evading an incoming attack does not trigger a counter return.'
    : 'Counter stance: prepare protection and the printed reply. Return follows full resistance of a covered incoming attack; its offensive range, Accuracy and avoidance checks still apply.';
  if (tag.id.startsWith('counter:') && def.counterCoverage) {
    const names = { physical: 'Physical', spell: 'Spell', melee: 'Melee', reach: 'Reach', ranged: 'Ranged', single: 'Single', area: 'Area' };
    const coverage = [def.counterCoverage.camps, def.counterCoverage.ranges, def.counterCoverage.targeting]
      .map(ids => (ids || []).map(id => names[id] || id).join(' + ')).filter(Boolean).join(' · ');
    return 'Counter coverage: ' + coverage + '. Covers only the incoming contacts listed for this card.';
  }
  return tag.blurb;
}
