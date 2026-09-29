// A defeated enemy's XP weight. The three contributions are additive so gear
// nudges the reward without multiplying the effect of a high level or HP roll.
const reference = Object.freeze({ hp: 24, poise: 10, attack: 8 });

export function enemyCombatPower(registries, enemy) {
  const def = enemy?.enemyId && registries?.enemies?.has?.(enemy.enemyId)
    ? registries.enemies.get(enemy.enemyId) : null;
  // Older receipts and the level-pace example have no enemy definition. Their
  // reference power is explicit rather than guessing combat stats from 0 HP.
  if (!def) return Number.isFinite(enemy?.combatPower) && enemy.combatPower >= 0 ? enemy.combatPower : 3;

  const level = Number.isSafeInteger(enemy.level) && enemy.level > 0 ? enemy.level : 1;
  const hp = Number.isFinite(enemy.maxHp) ? enemy.maxHp : (def.hp[0] + def.hp[1]) / 2;
  const poise = Number.isFinite(enemy.poiseMeter?.max) ? enemy.poiseMeter.max : def.poiseMax;
  const attack = Math.max(0, ...Object.values(def.moves || {}).filter((move) => move.intent === 'attack')
    .map((move) => (move.damage || 0) * (move.hits || 1)));
  const damageMult = Number.isFinite(enemy.damageMult) ? enemy.damageMult : 1;
  const stats = (hp / reference.hp + poise / reference.poise + attack * damageMult / reference.attack) / 3;
  return 1 + level / 5 + stats + (def.equipmentPower || 0);
}
