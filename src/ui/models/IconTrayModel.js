import { wireframeUi } from '../../content/wireframeUi.js';

// THE ICON TRAY PLAN (components/iconTray.js). One non-wrapping row of round
// icons: the combatant card's status effects, the relic rail and the Potions
// minis. When the icons do not fit, the last tile becomes the `+N`
// disclosure, so the row never scrolls or wraps. Local CSS px. DOM-free.
export function planIconTray({ count, width, rem = 16 } = {}, config = wireframeUi.iconTray) {
  const size = config.iconRem * rem;
  const gap = config.iconGapRem * rem;
  // Half a px of slack: a tray sized to N icons in CSS measures back a hair
  // short of N pitches through zoom and rounding, and must still hold N.
  const capacity = Math.max(1, Math.floor((Math.max(0, width) + gap + 0.5) / (size + gap)));
  const shown = count <= capacity ? count : Math.max(0, capacity - 1);
  return Object.freeze({ size, gap, capacity, shown, hidden: count - shown });
}
