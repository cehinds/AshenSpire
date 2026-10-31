// Combat log actor colors are presentation preferences. Keep the palette here
// so every log surface applies the same safe color and contrast rule.

export const COMBAT_LOG_PALETTE_DEFAULTS = Object.freeze({
  player: '#7fc4ff',
  enemy: '#ff8d83',
});

// The drawer is translucent over the scene, so check against a deliberately
// lighter bound than its usual dark surface to keep names readable everywhere.
const LOG_BACKGROUND = '#43403d';
const MIN_CONTRAST = 4.5;

function linearChannel(hex, offset) {
  const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  return 0.2126 * linearChannel(hex, 1) + 0.7152 * linearChannel(hex, 3) + 0.0722 * linearChannel(hex, 5);
}

export function hasCombatLogColorContrast(color, background = LOG_BACKGROUND) {
  if (!/^#[\da-f]{6}$/i.test(color || '') || !/^#[\da-f]{6}$/i.test(background || '')) return false;
  const a = luminance(color), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= MIN_CONTRAST;
}

export function combatLogPalette(settings = {}) {
  const player = settings?.combatLogPlayerColor ?? settings?.player;
  const enemy = settings?.combatLogEnemyColor ?? settings?.enemy;
  return Object.freeze({
    player: hasCombatLogColorContrast(player) ? player : COMBAT_LOG_PALETTE_DEFAULTS.player,
    enemy: hasCombatLogColorContrast(enemy) ? enemy : COMBAT_LOG_PALETTE_DEFAULTS.enemy,
  });
}
