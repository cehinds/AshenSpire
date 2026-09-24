// src/framework/resources.js — Mana and Stamina rules (framework contract:
// Mana and Stamina). Every constant comes from content/framework/mechanics.json.

import { mechanics } from './data/mechanics.js';

export function maximumMana({ classBase, wisdom, intelligence, bonuses = 0 }) {
  return Math.floor(
    classBase
    + wisdom * mechanics.mana.wisdomWeight
    + intelligence * mechanics.mana.intelligenceWeight
    + bonuses,
  );
}

export function createResourceState({ maxMana, maxStamina, mana = maxMana, stamina = maxStamina }) {
  return {
    maxMana, currentMana: mana,
    maxStamina, currentStamina: stamina,
    staminaSpentThisTurn: 0,
  };
}

/** Natural mana recovery per turn is zero; only rest and explicit effects refill. */
export function onTurnStartMana(state) {
  return { ...state, currentMana: state.currentMana + mechanics.mana.naturalRecoveryPerTurn };
}

export function onRestSpot(state) {
  return { ...state, currentMana: state.maxMana };
}

export function recoverMana(state, amount) {
  return { ...state, currentMana: Math.min(state.maxMana, state.currentMana + amount) };
}

export function spendStamina(state, amount) {
  if (amount > state.currentStamina) throw new Error(`stamina: cannot spend ${amount} of ${state.currentStamina}`);
  return {
    ...state,
    currentStamina: state.currentStamina - amount,
    staminaSpentThisTurn: state.staminaSpentThisTurn + amount,
  };
}

/** A refund returns the points but does not erase the spend (contract rule). */
export function refundStamina(state, amount, { erasesSpend = false } = {}) {
  return {
    ...state,
    currentStamina: Math.min(state.maxStamina, state.currentStamina + amount),
    staminaSpentThisTurn: erasesSpend
      ? Math.max(0, state.staminaSpentThisTurn - amount)
      : state.staminaSpentThisTurn,
  };
}

export function onTurnEndStamina(state) {
  const idle = state.staminaSpentThisTurn === 0;
  return {
    ...state,
    currentStamina: idle
      ? Math.min(state.maxStamina, state.currentStamina + mechanics.stamina.idleRecoveryPerTurn)
      : state.currentStamina,
    staminaSpentThisTurn: 0,
  };
}

/**
 * The Stamina a fight opens with (mechanics.stamina.combatStartRefill):
 * 'full' opens at the maximum, 'carry' where the last fight left it.
 */
export function staminaAtCombatStart({ currentStamina, maxStamina }) {
  const rule = mechanics.stamina.combatStartRefill;
  if (rule === 'full') return maxStamina;
  if (rule === 'carry') return currentStamina;
  throw new Error(`mechanics.stamina.combatStartRefill: expected 'full' or 'carry', got ${JSON.stringify(rule)}`);
}

/**
 * The Stamina deficit an equipment swap carried, as a fight opens under the
 * same rule: a 'full' refill leaves no deficit at all, so a later swap cannot
 * take refilled points back; 'carry' keeps the deficit as it stands.
 */
export function staminaDeficitAtCombatStart(carriedDeficit) {
  const rule = mechanics.stamina.combatStartRefill;
  if (rule === 'full') return 0;
  if (rule === 'carry') return carriedDeficit;
  throw new Error(`mechanics.stamina.combatStartRefill: expected 'full' or 'carry', got ${JSON.stringify(rule)}`);
}
