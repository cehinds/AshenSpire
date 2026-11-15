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

/**
 * PlayerFluxView(rules, player) → what the caster's second stance icon shows, or null when it is hidden (W25-F, owner 2026-11-15).
 * It shows while the fight has `elementFlux` rules and the player holds a flux or the Prepared stance: the flux element's icon, or the plain magic icon
 * (element null) after a spell with no element. `multiplier` is the rule's, read for the tooltip. Headless: no DOM.
 */
export function PlayerFluxView(rules, player, prepared) {
  if (!rules) return null;
  const element = player?.elementFlux || null;
  if (!element && !prepared) return null;
  return { element, multiplier: rules.multiplier };
}

/** FluxTip(view) → { title, body } of the second stance icon (the element's flux, or the plain magic mark). */
export function FluxTip(view) {
  if (!view?.element) return { title: t('stance.flux.plain.title'), body: t('stance.flux.plain.body') };
  const element = t(`stance.flux.name.${view.element}`);
  return { title: t('stance.flux.title', { element }), body: t('stance.flux.body', { element, multiplier: view.multiplier }) };
}

/** AdvancedTip() → { title, body } of the Advanced mark on the player (W25-BANDS). */
export const AdvancedTip = () => ({ title: t('stance.advanced.title'), body: t('stance.advanced.body') });
