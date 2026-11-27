import { ApplyGearCardRules, GearSummary, GearConditionState, GearTypeEffectsEnabled } from './gearEffects.js';
import { stanceManaCost, stanceStaminaCost } from './stanceRules.js';
// Card faces without a combat preview (deck, rewards, shop, upgrade picker, and the draw and discard pile viewers) used to print the card's authored cost
// while the fight priced it with the spell cost rule. Owner, 2026-11-15 (batch 4): show the price the player would pay.
//   outside a fight: a face has no stance, so Prepared is not applied; surcharges and always-on gear adjustments are;
//   inside a fight (a pile viewer): the fight's own stance and loadout price it, exactly as the hand does, Prepared included.
// A run made before the spell cost ruling carries no `spellCosts` rule and keeps printed costs. The UI shell registers the run (main.js) and the fight
// (screens/combat.js), and the pricer (the engine's SpellCostAdjust: this model layer may not import the engine), and the faces read them live.

let faceRun = null, runSource = null, faceCombat = null, pricer = null;

/** SetFaceCostRun(run) -> remember the run whose rules and loadout price out-of-combat faces (null clears it). */
export function SetFaceCostRun(run) { faceRun = run || null; }
/** SetFaceCostRunSource(read) -> the shell's live run, read at each face (the run it holds changes on a new game, a load and a quit). */
export function SetFaceCostRunSource(read) { runSource = typeof read === 'function' ? read : null; }
/** SetFaceCostCombat(combat) -> remember the live fight that prices faces while it is on screen (null clears it). */
export function SetFaceCostCombat(combat) { faceCombat = combat || null; }
/** ReleaseFaceCostCombat(combat) -> forget the fight, unless a newer mount of another fight has already registered itself. */
export function ReleaseFaceCostCombat(combat) { if (faceCombat === combat) faceCombat = null; }
/** SetFaceCostPricer(fn) -> the spell cost rule, fn(ctx, def, { stamina, mana }) -> { stamina, mana } (engine/spellCosts.js SpellCostAdjust). */
export function SetFaceCostPricer(fn) { pricer = typeof fn === 'function' ? fn : null; }

/**
 * FaceCostProfile(registries, def, run?) -> registries.framework.costProfile(def), with the spell cost rule applied when the fight or run's rules carry it.
 * The same object comes back when nothing changes (no run, a card that is no spell, a run without the rule, no pricer registered).
 */
export function FaceCostProfile(registries, def, run = faceRun ?? runSource?.() ?? null) {
  if (!pricer) return registries.framework.costProfile(def);
  const fight = faceCombat && !faceCombat.result ? faceCombat : null;
  const ctx = fight || (run && { registries, combatExpansionVersion: run.combatExpansionVersion, fixCoreRules: run.fixCoreRules, gameProfile: run.gameProfile, loadout: run.loadout,
    relics: run.relics, player: { classId: run.class } });
  if (!ctx) return registries.framework.costProfile(def);
  if (GearTypeEffectsEnabled(ctx) && !def.gearManaRules && !def.gearApplied?.some(row => row.stat === 'cost' || row.stat === 'manaCost')) {
    const summary = GearSummary(registries, ctx.loadout, ctx.player?.classId, ctx);
    const rules = (fight?.player?.itemProps?.cardRules || summary.cardRules).filter(row => row.stat === 'cost' || row.stat === 'manaCost');
    def = ApplyGearCardRules(rules, def, GearConditionState(ctx.player, summary.mainWeaponType));
  }
  let profile = registries.framework.costProfile(def);
  if (fight && GearTypeEffectsEnabled(ctx)) {
    const mana = stanceManaCost(profile.mana || 0, ctx.player, def, ctx);
    const stamina = stanceStaminaCost(profile.stamina || 0, ctx.player, def, ctx, profile.mana || 0);
    profile = { ...profile, mana, stamina, ...(def.cost === 'X' ? {} : { action: stamina }) };
  }
  const price = pricer(ctx, def, { stamina: profile.stamina || 0, mana: profile.mana || 0 });
  if (price.stamina === (profile.stamina || 0) && price.mana === (profile.mana || 0)) return profile;
  return { ...profile, mana: price.mana, stamina: price.stamina, ...(def.cost === 'X' ? {} : { action: price.stamina }) };
}
