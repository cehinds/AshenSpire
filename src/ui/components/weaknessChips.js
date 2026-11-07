// Enemy weakness chips (owner, 2026-11-01; SPEC 5.3): up to two small square icon chips under the enemy's nameplate, one per
// DISCOVERED weakness (the caller filters with model/weaknessDiscovery.js; an undiscovered weakness draws nothing).
// The icon is the trigger's own damage-type, element or status mark; the tooltip is the same one the combat badges use.
import { describeWeakness } from '../../model/enemyWeaknessRules.js';
import { weaknessIconId } from '../../model/weaknessIcons.js';
import { tagSymbolSvg } from './cardTagSymbols.js';
import { attachTooltip, esc } from './tooltip.js';

/** "Weak to Piercing: +25% damage" - the chip's tooltip text, its accessible name and its fallback title. */
export function weaknessChipText(weakness) {
  const { label, text } = describeWeakness(weakness);
  return { label, text, full: `Weak to ${label}: ${text}` };
}

export function weaknessChips(weaknesses, { limit = 2 } = {}) {
  return (Array.isArray(weaknesses) ? weaknesses : []).slice(0, limit).map(weakness => {
    const { label, text, full } = weaknessChipText(weakness);
    const chip = document.createElement('span');
    chip.className = 'weakness-chip';
    chip.dataset.weakness = weakness.to;
    chip.dataset.effect = weakness.effect;
    chip.tabIndex = 0;
    chip.setAttribute('role', 'img');
    chip.setAttribute('aria-label', full);
    const mark = document.createElement('span');
    mark.className = 'weakness-chip-icon';
    mark.setAttribute('aria-hidden', 'true');
    mark.append(tagSymbolSvg(weaknessIconId(weakness.to) || 'effect:cracked'));
    chip.append(mark);
    attachTooltip(chip, () => `<div class="tt-title">Weak to ${esc(label)}</div>${esc(text)}`);
    return chip;
  });
}
