// Stamina is the single turn budget. Keep the old engine field names as
// accessors for effects, saves and network clients; never keep a second pool.
export function bindTurnStamina(player) {
  for (const [legacy, current] of [['energy', 'stamina'], ['energyMax', 'maxStamina']]) {
    Object.defineProperty(player, legacy, {
      enumerable: true, configurable: true,
      get() { return this[current]; },
      set(value) { this[current] = value; },
    });
  }
  return player;
}
