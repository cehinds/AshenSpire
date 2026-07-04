// src/content/customMods.js — Custom Climb modifiers (data only).
//
// A tailored take on Slay the Spire 2's custom mode. Three groups:
//   • DIFFICULTY — harder rules; the Ascension ladder just enables the first N
//     of these in ASCENSION_ORDER, so "Ascension 4" == the four hardest-first
//     rules, and every rule is also individually toggleable.
//   • CHAOS — flavourful run-warping toggles, independent of difficulty.
//   • DECK_MODES — how your starting deck is built.
// The orchestrator (main.js) reads run.custom.mods[id] at the relevant hook;
// nothing here is engine-specific.

export const DIFFICULTY_MODS = [
  { id: 'toughElites', label: 'Tough Elites', desc: 'Elites and bosses have +30% HP.' },
  { id: 'lessHealing', label: 'Scarce Grace', desc: 'Shrine rest and between-act healing are halved.' },
  { id: 'deadlyEnemies', label: 'Deadly Foes', desc: 'Every enemy begins combat with +1 Strength.' },
  { id: 'cursedStart', label: 'Cursed Start', desc: 'Begin the run with a Guilt curse shuffled into your deck.' },
  { id: 'expensiveShops', label: 'Greedy Merchants', desc: 'Shop prices are 50% higher.' },
  { id: 'bigBosses', label: 'Dread Bosses', desc: 'Act bosses have +50% HP.' },
];

export const CHAOS_MODS = [
  { id: 'allElite', label: 'Elite Gauntlet', desc: 'Every monster node is an Elite fight.' },
  { id: 'hoarder', label: 'Hoarder', desc: 'Start with +250 runes — but every shop price doubles.' },
  { id: 'chaosRewards', label: 'Chaos Rewards', desc: 'Card rewards ignore rarity: rares everywhere.' },
  { id: 'glassCannon', label: 'Glass Cannon', desc: 'You deal +25% damage, but take +25% damage.' },
];

export const DECK_MODES = [
  { id: 'standard', label: 'Standard', desc: "Your class's normal starting deck." },
  { id: 'sealed', label: 'Sealed', desc: 'A random starting deck drawn from your class pool.' },
  { id: 'draft', label: 'Draft', desc: 'Draft your starting deck card by card.' },
];

// Ascension enables the first N difficulty rules (hardest impact first).
export const ASCENSION_ORDER = [
  'toughElites',
  'deadlyEnemies',
  'lessHealing',
  'bigBosses',
  'cursedStart',
  'expensiveShops',
];
export const MAX_ASCENSION = ASCENSION_ORDER.length;

export const ALL_MODS = [...DIFFICULTY_MODS, ...CHAOS_MODS];

// True when a run carries any non-default rule (so it is flagged + excluded
// from win-rate telemetry).
export function isCustomRun(custom) {
  if (!custom) return false;
  if (custom.ascension > 0) return true;
  if (custom.deckMode && custom.deckMode !== 'standard') return true;
  return !!(custom.mods && Object.values(custom.mods).some(Boolean));
}

// Resolve the effective active-mod set: explicit toggles OR ascension-enabled.
export function activeMods(custom) {
  const out = { ...((custom && custom.mods) || {}) };
  const asc = (custom && custom.ascension) || 0;
  for (let i = 0; i < asc && i < ASCENSION_ORDER.length; i++) out[ASCENSION_ORDER[i]] = true;
  return out;
}
