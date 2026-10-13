// src/engine/combatRounds/stance.js — the timeline stance and kind of an action (SPEC §4.11, stance-advantage.csv).
//
// Pure: no DOM, no imports. Shared by the rounds adapter and the action-cost model (model/actionCosts.js), which
// would otherwise import the adapter in a cycle.

// The timeline stance of an action (the stance-advantage table's names). Tags can name a heavy or a
// wide attack; otherwise the kind decides.
const KIND_STANCE = Object.freeze({ attack: 'attack', guard: 'block', evade: 'evade', counter: 'counter' });
export function stanceFor(kind, tags = []) {
  // The content tags a heavy or wide attack as maneuver:smash / maneuver:sweep (cards and enemy moves alike); a bare
  // smash or sweep tag counts too.
  if (kind === 'attack' && (tags.includes('smash') || tags.includes('maneuver:smash'))) return 'smash';
  if (kind === 'attack' && (tags.includes('sweep') || tags.includes('maneuver:sweep'))) return 'sweep';
  return KIND_STANCE[kind] ?? null;
}

// Kinds the timeline knows: attack, guard, evade, counter and other. A preemptive kind (guard, evade,
// counter) must target its owner or a foe (guard and evade: self), so the caller passes the target.
export function playerKind({ isAttack, effects = [], maneuver }) {
  if (isAttack) return 'attack';
  if (effects.some((e) => e?.op === 'dodgeRoll')) return 'evade';
  if (maneuver === 'counter') return 'counter';
  if (effects.some((e) => e?.op === 'block')) return 'guard';
  return 'other';
}

// An enemy move's timeline kind, from its authored intent. `damage` decides an attack, as the
// enemy's intent box does.
export function moveKind(move) {
  if (move?.damage != null || move?.intent === 'attack') return 'attack';
  if (move?.intent === 'block' || move?.block != null) return 'guard';
  if (move?.intent === 'counter') return 'counter';
  return 'other';
}

