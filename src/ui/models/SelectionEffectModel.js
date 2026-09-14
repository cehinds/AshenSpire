import { wireframeUi } from '../../content/wireframeUi.js';

// WCF3 selection effect. A selected owner (a card, a combatant) wears ONE
// shared glow over its whole visible assembly — art, name, parts and its
// delayed inspect control — never an outline or shadow per child. The inspect
// control appears only after the selection has stood for the reveal delay.

export function selectionEffect(config = wireframeUi.selection) {
  const { glowRem, revealDelayMs } = config || {};
  if (!(Number.isFinite(glowRem) && glowRem > 0)) throw new Error('selection: glowRem must be a positive number');
  if (!(Number.isFinite(revealDelayMs) && revealDelayMs >= 0)) throw new Error('selection: revealDelayMs must be zero or more');
  return Object.freeze({ glowRem, revealDelayMs });
}

// The CSS filter every selected owner shares. The radius is in reference rems
// (at least 16 physical px, as in the hand and footer plans), so it does not
// shrink with the game's 10px root; the colour stays the theme's gold token.
export const REFERENCE_REM_CSS = 'max(16px / var(--ui-zoom, 1), 1rem)';
export function selectionGlowFilter(config = wireframeUi.selection) {
  return `drop-shadow(0 0 calc(${selectionEffect(config).glowRem} * ${REFERENCE_REM_CSS}) var(--gold))`;
}

export function selectionRevealDelayMs(config = wireframeUi.selection) {
  return selectionEffect(config).revealDelayMs;
}
