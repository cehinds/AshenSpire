import { t } from '../strings.js';
import { staminaOrb } from '../../content/staminaOrb.js';

export const manaRingEnabled = (settings = {}) => settings.manaRing !== false;
export const combatVitals = (bars, settings) => manaRingEnabled(settings) ? bars.filter(bar => bar.id !== 'mana') : bars;
export const manaGemSize = ({ gemSize, radius, maxMana }) => Math.min(gemSize * 9, 2 * Math.PI * radius * 9 / Math.max(1, maxMana) / 1.3);

export function staminaOrbModel({ stamina = 0, maxStamina = 0, mana = 0, maxMana = 0, settings = {} } = {}) {
  const current = Number.isFinite(stamina) ? Math.max(0, stamina) : 0;
  const maximum = Number.isFinite(maxStamina) ? Math.max(0, maxStamina) : 0;
  const count = Number.isFinite(maxMana) ? Math.max(0, Math.floor(maxMana)) : 0;
  const available = Number.isFinite(mana) ? Math.max(0, Math.min(count, Math.floor(mana))) : 0;
  const ring = manaRingEnabled(settings);
  const radius = staminaOrb.radius * 9;
  const size = manaGemSize({ ...staminaOrb, maxMana: count });
  const gems = ring ? Array.from({ length: count }, (_, i) => {
    const angle = (-90 - i * 360 / count + staminaOrb.rotation) * Math.PI / 180;
    return { id: i < available ? 'diamond' : 'spent', x: 450 + Math.cos(angle) * radius, y: 450 + Math.sin(angle) * radius, size };
  }) : [];
  return { current, maximum, available, count, ring, gems,
    label: `${t('combat.actions')} ${current} of ${maximum}. Mana ${available} of ${count}.`,
  };
}
