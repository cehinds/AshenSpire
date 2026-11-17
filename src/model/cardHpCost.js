// A card's nonlethal HP cost (playtest 2026-11-17, theme C): an overtuned card pays HP when played, and that payment may never kill.
// The engine refuses the play (actions.js preflightCardHp); the hand and the simbot read the same number here, so neither offers a
// play the engine would refuse.

/** The HP a card's nonlethal self `loseHp` effects take on play (plain numbers, no condition); 0 when it has none. */
export function NonlethalHpCost(def) {
  return (def?.effects || [])
    .filter((effect) => effect.op === 'loseHp' && effect.nonlethal === true && effect.target === 'self' && !effect.if && Number.isFinite(effect.amount))
    .reduce((sum, effect) => sum + Math.max(0, effect.amount) * (Number.isFinite(effect.repeat) ? Math.max(0, effect.repeat) : 1), 0);
}

/** Why the card cannot be played at the player's current HP, or '' when it can: the cost must leave at least 1 HP. */
export function NonlethalHpRefusal(def, player) {
  const cost = NonlethalHpCost(def);
  if (!cost || !player || cost < player.hp) return '';
  return `Not enough HP: it costs ${cost} HP and must leave you at least 1.`;
}
