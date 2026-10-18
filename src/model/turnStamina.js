// Stamina is the single turn budget. Keep the old engine field names as
// accessors for effects, saves and network clients; never keep a second pool.
const installedAliases = new WeakMap();

export function bindTurnStamina(player) {
  const aliases = new Map();
  for (const [legacy, current] of [['energy', 'stamina'], ['energyMax', 'maxStamina']]) {
    Object.defineProperty(player, legacy, {
      enumerable: true, configurable: true,
      get() { return this[current]; },
      set(value) { this[current] = value; },
    });
    aliases.set(legacy, { ...Object.getOwnPropertyDescriptor(player, legacy), current });
  }
  installedAliases.set(player, aliases);
  return player;
}

// Inspect only this owner's exact installed alias; never invoke an accessor.
// A changed/inherited alias or non-data backing field has no ownership proof.
export function turnStaminaAliasData(player, key, descriptor) {
  const alias = installedAliases.get(player)?.get(key);
  if (!alias || descriptor.get !== alias.get || descriptor.set !== alias.set
    || descriptor.enumerable !== alias.enumerable || descriptor.configurable !== alias.configurable) return null;
  const current = Object.getOwnPropertyDescriptor(player, alias.current);
  return current && 'value' in current ? current : null;
}
