// Intent reads never change move selection. Only the engine rolls visibility.
import { combatIntent } from '../content/combatMatchups.js';
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function hiddenIntentChance(attributes = {}, rules = {}) {
  const base = finite(rules.baseHiddenChance, combatIntent.baseHiddenChance);
  const wisdom = finite(attributes.wisdom, 0);
  const intelligence = finite(attributes.intelligence, 0);
  const chance = base - wisdom * finite(rules.wisdomReduction, combatIntent.wisdomReduction)
    - intelligence * finite(rules.intelligenceReduction, combatIntent.intelligenceReduction);
  return Math.max(finite(rules.minimumHiddenChance, combatIntent.minimumHiddenChance),
    Math.min(finite(rules.maximumHiddenChance, combatIntent.maximumHiddenChance), chance));
}

export function combatIntentStance(intent = {}, profile = intent.profile || {}) {
  if (intent.stance) return intent.stance;
  if (intent.kind === 'staggered') return 'staggered';
  if (profile.maneuver === 'counter') return 'countering';
  if (profile.maneuver === 'defend') return 'defending';
  if (profile.maneuver === 'sweep') return 'sweeping';
  if (profile.camp === 'spell' || profile.camp === 'spells' || profile.camp === 'magic') return 'casting';
  if (profile.maneuver === 'ranged') return 'ranged';
  if (profile.maneuver === 'smash') return 'smashing';
  if (intent.kind === 'block' || intent.kind === 'defend') return 'defending';
  if (profile.maneuver === 'attack' || intent.kind === 'attack' || intent.kind === 'attackDebuff') return 'attacking';
  return 'preparing';
}

// An allowlist protects future fields too: copying an intent and deleting a
// few current fields would reveal new move-specific metadata by accident.
export function concealIntent(intent = {}, profile = intent.profile || {}) {
  const stance = combatIntentStance(intent, profile);
  const kind = stance === 'defending' ? 'block' : stance === 'staggered' ? 'staggered' : 'unknown';
  return {
    kind,
    moveId: null,
    stance,
    hidden: true,
    revealed: false,
    profile: { camp: profile.camp || null, maneuver: profile.maneuver || null },
  };
}
