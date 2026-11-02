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
  if (!plan.options.some((o) => o.id === choice)) {
    throw new Error(`Choose a stance: ${plan.options.map((o) => o.id).join(', ')}`);
  }
  return choice;
}
