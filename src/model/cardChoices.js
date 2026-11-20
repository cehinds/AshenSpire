// src/model/cardChoices.js — the pending choice a card offers before it plays
// (SPEC §5.2 Warrior's Vow: "Enter a Stance of your choice").
//
// A card asks for a choice through its DATA: an `enterStance` effect with
// `choose: 'classStance'` instead of a fixed `stance`. The offer is every
// stance row whose `class` is the playing character's class; a character whose
// class owns no stance is offered the card's own class's stances, so a card
// carried across classes still has something to choose. The choice rides the
// play intent (`choice`), the same way a target does, and the engine refuses a
// play without a legal one before anything is spent. The engine (engine/combat.js)
// and the screens all read this one function.

import { uiStrings } from '../content/generated/uiStrings.js';
import { configuredModule } from './profileModule.js';

// The maneuver pick's label. The id stays 'casting' (the engine maps it); a profile whose configured stances module
// names the stance 'prepared' (Core, owner 2026-11-01) shows the stance.name.prepared string instead.
function maneuverLabel(registries, id) {
  const stances = configuredModule(registries, 'stances');
  const shown = id === 'casting' && stances?.include?.includes('prepared') && !stances.include.includes('casting') ? 'prepared' : id;
  return uiStrings.find(r => r.id === `stance.name.${shown}`)?.short || shown[0].toUpperCase() + shown.slice(1);
}

/** The closed set of choice selectors an `enterStance` effect may carry. */
export const STANCE_CHOICE_SELECTORS = Object.freeze(['classStance','maneuver']);

/**
 * cardChoice(registries, def, classId, activeStanceId) → null when the card
 * plays without a choice, else { kind: 'stance', options: [{ id, name, icon,
 * tooltip, active }] }. `active` marks the stance the player is already in.
 * Re-entering it does nothing: the foundation rules refuse it ("That stance
 * is already active", engine/combatRules.js) and the legacy rules make it a
 * no-op that still spends the card. So the dialog shows it but disables it
 * (#1449 review, Codex P2).
 * The option stays listed (and `assertCardChoice` still accepts its id) so the
 * refusal stays the engine's one rule, not a second copy here.
 */
export function cardChoice(registries, def, classId, activeStanceId = null) {
  // A card with named modes (owner 2026-11-15, W25-EvadeCards: Dodge Roll's "Advance or Retreat"): one row per mode, no stance.
  if (def?.choiceModes?.length) return { kind: 'mode', options: def.choiceModes.map((m) => ({ id: m.id, name: m.name, icon: m.icon || '', tooltip: m.tooltip || '', active: false })) };
  const effect = (def && def.effects || []).find((e) => e && e.op === 'enterStance' && e.choose);
  if (!effect) return null;
  if(effect.choose==='maneuver') return {kind:'stance',options:['attack','smash','defend','sweep','counter','casting'].map(id=>({id,name:maneuverLabel(registries,id),icon:'',tooltip:id,active:activeStanceId===id}))};
  const rows = registries.stances.all();
  let owned = rows.filter((s) => s.class && s.class === classId);
  if (!owned.length) owned = rows.filter((s) => s.class && s.class === def.class);
  return {
    kind: 'stance',
    options: owned.map((s) => ({ id: s.id, name: s.name, icon: s.icon, tooltip: s.tooltip, active: !!activeStanceId && s.id === activeStanceId })),
  };
}

/** Throws unless `choice` is legal for `plan` (null plan ⇒ no choice allowed). */
export function assertCardChoice(plan, choice) {
  if (!plan) {
    if (choice != null) throw new Error('This card offers no choice');
    return null;
  }
  // A card's named modes default to the first when a headless caller (a bot, a test) names none; the screen always asks.
  if (plan.kind === 'mode' && choice == null) return plan.options[0].id;
  if (!plan.options.some((o) => o.id === choice)) {
    throw new Error(`${plan.kind === 'mode' ? 'Choose one' : 'Choose a stance'}: ${plan.options.map((o) => o.id).join(', ')}`);
  }
  return choice;
}

/** The card with only the effects of the chosen mode (an effect with no `mode` always plays); a card with no modes comes back unchanged. */
export function CardModeEffects(def, chosen) {
  if (!def?.choiceModes?.length) return def;
  return { ...def, effects: (def.effects || []).filter((effect) => !effect.mode || effect.mode === chosen) };
}

/** Auto battle's answer to a card's pending choice (W25-EvadeCards): a card of named modes plays its first mode (Dodge Roll: Advance), as a headless
 * play does; a card that needs a stance pick is left to the player. { playable, choice } with `choice` null when the card has no choice. */
export function AutoCardChoice(plan) {
  if (!plan) return { playable: true, choice: null };
  if (plan.kind === 'mode' && plan.options.length) return { playable: true, choice: plan.options[0].id };
  return { playable: false, choice: null };
}
