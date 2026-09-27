// src/model/serviceCombat.js — a fight a service event starts (SPEC §14.3),
// headless.
//
// The market's quest event opens the event door after the shop visit closes.
// When its choice starts a fight (`startCombat`), that fight belongs to the
// event, not to the map node the run stands on. On an atlas journey a node's
// fight is the journey's own encounter (worldAtlas.js journeyEncounter), and
// winning it completes the node; a service event's fight must do neither
// (Codex P1 on #1377). So its combat receipt carries `serviceEvent: true`,
// which rides the save, and the two questions the combat door asks read it
// here: which encounter to fight, and whether a victory completes the node.
import { journeyEncounter } from './worldAtlas.js';

/** The combat receipt a service event's startCombat writes. */
export function serviceEventCombatEntry(nodeId, encounterId) {
  return { nodeId, encounterId, serviceEvent: true };
}

/**
 * combatEncounterFor(registries, run, entry) → the encounter a fight is
 * against. A journey node's fight is the journey's own outcome at that node;
 * a service event's fight (and every fight off the atlas, or in a legacy
 * dungeon) is exactly the receipt's `encounterId`.
 */
export function combatEncounterFor(registries, run, { nodeId, encounterId, serviceEvent = false } = {}) {
  if (run.journey && !run.legacyDungeon && serviceEvent !== true) return journeyEncounter(run.journey, nodeId, registries);
  return registries.encounters.get(encounterId);
}

/** Whether winning the fight now standing completes the journey node: never for a service event's fight. */
export function victoryCompletesJourneyNode(run) {
  return !!run.journey && !run.legacyDungeon && run.combatEntered?.serviceEvent !== true;
}
