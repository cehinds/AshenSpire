// Silhouette effects are applied to the image alpha, never the sprite box.
export const POWER_FRAMES = Object.freeze({
  power1: { radius: 1.4, blur: 3, alpha: .55, brightness: 1.03 },
  power2: { radius: 2.6, blur: 8, alpha: .95, brightness: 1.16 },
  power3: { radius: 1.8, blur: 5, alpha: .7, brightness: 1.06 },
});
const colors = { stamina: '88,225,131', mana: '91,165,255', hp: '255,91,102', power: '220,221,255' };
export function resourceAura(card = {}, receipt) {
  const result = [];
  if ((receipt?.staminaSpent ?? card.staminaCost ?? 0) > 0) result.push('stamina');
  if ((receipt?.manaSpent ?? card.manaCost ?? 0) > 0) result.push('mana');
  // Only immediate self-payment; delayed status damage and enemy damage do not
  // turn the casting outline red. Receipts suppress payment prevented in play.
  const selfPayment = (card.effects || []).some(e => e.op === 'loseHp' && e.target === 'self' && (typeof e.amount !== 'number' || e.amount > 0));
  if ((card.hpCost > 0 || selfPayment) && (receipt?.hpSpent ?? 1) > 0) result.push('hp');
  return result;
}
export function auraFilter(pose, rest = 'idle', resources = [], active = false) {
  const phase = POWER_FRAMES[pose];
  const guarded = ['guard', 'shieldGuard', 'parry'].includes(rest);
  const palette = active && resources.length ? resources : phase ? ['power'] : guarded ? ['mana'] : [];
  if (!palette.length) return 'none';
  const faded = !active && !phase;
  const radius = phase?.radius ?? (faded ? 1 : 1.6);
  const alpha = phase?.alpha ?? (faded ? .26 : .8);
  const blur = phase?.blur ?? (faded ? 3 : 5);
  const filters = palette.flatMap((key, i) => {
    const color = `rgba(${colors[key] || colors.power},${alpha})`;
    const r = radius + i * 1.3;
    return [`drop-shadow(${r}px 0 0 ${color})`, `drop-shadow(${-r}px 0 0 ${color})`, `drop-shadow(0 ${r}px ${blur}px ${color})`];
  });
  if (phase) filters.push(`brightness(${phase.brightness})`);
  return filters.join(' ');
}
