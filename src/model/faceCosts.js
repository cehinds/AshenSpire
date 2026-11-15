// Card faces outside a fight (deck, rewards, shop, upgrade picker) used to print the card's authored cost while the fight priced it with the spell cost rule.
// Owner, 2026-11-15 (batch 4): show the price the player would pay under the shipped rules there too. A face has no stance, so Prepared is not applied;
// the surcharges and the Focus discount (when a Focus item is equipped in the run's loadout) are. A run made before the spell cost ruling carries no
// `spellCosts` rule and keeps printed costs. The run is registered once by the UI shell (main.js) and read live, so an equipment swap changes the next face.
import { SpellCostAdjust } from '../engine/spellCosts.js';

let faceRun = null;

/** SetFaceCostRun(run) -> remember the run whose rules and loadout price out-of-combat faces (null clears it). */
export function SetFaceCostRun(run) { faceRun = run || null; }

/**
 * FaceCostProfile(registries, def, run?) -> registries.framework.costProfile(def), with the spell cost rule applied when the run's rules carry it.
 * The same object comes back when nothing changes (no run, a card that is no spell, a run without the rule).
 */
export function FaceCostProfile(registries, def, run = faceRun) {
  const profile = registries.framework.costProfile(def);
  if (!run) return profile;
  const ctx = { registries, combatExpansionVersion: run.combatExpansionVersion, fixCoreRules: run.fixCoreRules, gameProfile: run.gameProfile, loadout: run.loadout, player: { classId: run.class } };
  const price = SpellCostAdjust(ctx, def, { stamina: profile.stamina || 0, mana: profile.mana || 0 });
  if (price.stamina === (profile.stamina || 0) && price.mana === (profile.mana || 0)) return profile;
  return { ...profile, mana: price.mana, stamina: price.stamina, ...(def.cost === 'X' ? {} : { action: price.stamina }) };
}
