import { fixCoreProtectionDescription, fixCoreWardDisabled } from '../model/fixCoreMechanics.js';
import { configuredCombat } from '../engine/gameProfileCombat.js';
import { tFull } from './strings.js';

/**
 * The Poise tooltip. The locked FixCore description covers the physical 25% absorb; under a configured Core fight with
 * Ward off (owner, 2026-10-31) a spell meets Poise first, one for one, so that sentence is appended from uiStrings.
 */
export function poiseHelpText(combat, entity) {
  const base = fixCoreProtectionDescription(combat, entity, 'poise');
  if (!base) return tFull('combat.protection.poise');
  return configuredCombat(combat) && fixCoreWardDisabled(combat) ? `${base} ${tFull('combat.tooltip.poiseMagic')}` : base;
}
