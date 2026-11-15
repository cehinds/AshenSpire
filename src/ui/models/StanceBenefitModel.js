// What the held-stance control says about itself (owner, 2026-11-14, Wave 2.5): the stance's name and its natural benefit, in the words of
// content/source/uiStrings.csv (stance.name.*, stance.benefit.*). Headless: no DOM. The numbers are in fixCoreMechanics.json `stanceBenefits`.
import { t } from '../strings.js';

const ALIASES = Object.freeze({ ranged: 'attack', casting: 'prepared' });
const STANCES = new Set(['attack', 'smash', 'sweep', 'counter', 'defend', 'prepared']);

/**
 * StanceBenefitTip(maneuver) → { title, body } for a maneuver id as the HUD glyph carries it.
 * The resting glyph ('prepare', 'ready' or nothing) stands for both a caster and a player holding no stance, so it states both benefits.
 */
export function StanceBenefitTip(maneuver) {
  const id = ALIASES[maneuver] || maneuver;
  if (STANCES.has(id)) return { title: t(`stance.name.${id}`), body: t(`stance.benefit.${id}`) };
  return { title: t('stance.tip.rest'), body: `${t('stance.benefit.prepared')} ${t('stance.benefit.neutral')}` };
}
