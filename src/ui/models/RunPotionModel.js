import { potionContents } from './PotionContentsModel.js';
import { CHARGE_FLASK_KINDS, chargeFlaskDefinition } from '../../model/gracerefill.js';
import { flaskActionPlan } from '../../model/flaskActions.js';
import { useRunChargeFlask } from '../../engine/actions.js';
import { t } from '../strings.js';

// POTIONS BETWEEN FIGHTS (owner, 2026-09-14: the Potions control on the map).
// What each WGH8 entry may do off the battlefield, decided once so the map's
// Potions list and its minis cannot disagree, and testable without a DOM.
// These are the rules the room rail's icons carried (components/runHud.js):
//
//   · a charge flask is drunk only with "Use flasks outside combat" on and a
//     charge left, and it stays with the run (never dropped);
//   · a carried potion is for combat only, and may be dropped here.
//
// `drinkOutsideCombat` is the caller's reading of that setting, so this module
// does not reach into the Settings screen.

/** The WGH8 entries of this run with their definitions, in list order. */
export function runPotionRows(registries, run) {
  return potionContents({ chargeKinds: CHARGE_FLASK_KINDS, flaskCharges: run.flaskCharges, carried: run.flasks }).entries
    .map((entry) => ({
      entry,
      def: entry.category === 'charge' ? chargeFlaskDefinition(registries, entry.kind) : registries.flasks.get(entry.flaskId),
    }))
    .filter((row) => !!row.def);
}

/** The flask action plan (model/flaskActions.js, `run` context) for one entry. */
export function runPotionPlan(entry, { drinkOutsideCombat = false } = {}) {
  if (entry.category === 'charge') {
    return flaskActionPlan({
      context: 'run',
      canUse: drinkOutsideCombat && entry.count > 0,
      useReason: entry.count <= 0 ? t('potions.run.empty') : t('potions.run.setting'),
      canDrop: false,
      dropReason: t('potions.run.keep'),
    });
  }
  return flaskActionPlan({ context: 'run', canUse: false, useReason: t('potions.run.combatOnly'), canDrop: true });
}

/** The one verb the Potions list offers: Drink a charge flask, Drop a carried one. */
export function runPotionVerb(entry, plan) {
  return plan.actions.find((action) => action.id === (entry.category === 'charge' ? 'use' : 'drop'));
}

/**
 * Apply an enabled action to the run. Returns true when the run changed.
 * Only what the plan enabled can happen: a disabled or unknown action, or a
 * verb that does not fit the entry's category, changes nothing.
 */
export function applyRunPotion({ registries, run, entry, actionId, plan }) {
  const action = plan.actions.find((row) => row.id === actionId);
  if (!action || !action.enabled) return false;
  if (actionId === 'use' && entry.category === 'charge') {
    useRunChargeFlask({ run, registries, rng: null, kind: entry.kind });
    return true;
  }
  if (actionId === 'drop' && entry.category === 'carried') {
    // Drop ONE of this kind: the first slot holding it, as the room rail did.
    const at = (run.flasks || []).findIndex((flask) => flask && flask.flaskId === entry.flaskId);
    if (at < 0) return false;
    run.flasks.splice(at, 1);
    return true;
  }
  return false;
}
