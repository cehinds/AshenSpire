import { wireframeUi } from '../../content/wireframeUi.js';

// WCM0 lower meters (CURRENT-SPECIFICATION, combatant legibility). One rule
// for every row's height and for which rows wait for selection. Inputs and
// outputs are local (pre-zoom) CSS px; physical minimums divide through the
// UI zoom once, and `rem` is the reference rem (at least 16 physical px).

export const METER_ROW_KINDS = Object.freeze(['name', 'hp', 'resource', 'buildup', 'stance']);

export function combatantMeterGeometry({ zoom = 1, rem = 16 } = {}, config = wireframeUi.combatantMeters) {
  const hp = Math.max(config.hpMinRem * rem, config.hpMinPx / zoom);
  return Object.freeze({
    hp,
    // A secondary row is half the HP row, never below its own readable floor.
    secondary: Math.max(hp * config.secondaryFraction, config.secondaryMinRem * rem),
    stance: Math.max(hp, config.stanceMinRem * rem),
    valueText: config.valueTextPx / zoom,
    gap: config.gapPx / zoom,
  });
}

// Whether a row of this kind is drawn only while its combatant is selected.
// HP never waits: it is the one row every combatant always shows.
export function meterRowSelectedOnly(kind, config = wireframeUi.combatantMeters) {
  if (!METER_ROW_KINDS.includes(kind)) throw new Error(`Unknown meter row kind '${kind}'`);
  return kind !== 'hp' && config.selectedOnly.includes(kind);
}
