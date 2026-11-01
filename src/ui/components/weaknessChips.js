// Enemy mini HUD weakness chips (owner, 2026-10-31; SPEC 5.3): up to two small glyph chips beside the status row.
// The glyph is the trigger's own damage-type or status icon; a trigger with no icon art falls back to its first letter.
import { pill, glyph } from '../kit/index.js';
import { describeWeakness } from '../../model/enemyWeaknessRules.js';

export function weaknessChips(weaknesses, { limit = 2 } = {}) {
  return (Array.isArray(weaknesses) ? weaknesses : []).slice(0, limit).map(weakness => {
    const { label, text } = describeWeakness(weakness);
    const chip = pill({ label: '', attrs: { class: 'weakness-chip', title: `Weak to ${label}: ${text}`, dataset: { weakness: weakness.to, effect: weakness.effect } } });
    const art = glyph(weakness.to, { class: 'ic' });
    if (!art.childElementCount) art.textContent = label.charAt(0);
    chip.append(art);
    return chip;
  });
}
