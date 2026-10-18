import { fixCoreEnabled, fixCoreRules } from './fixCoreMechanics.js';
// The authority creates a read once. UI/preview callers only project it.
export const PREDICTION_CHOICES = Object.freeze(['Attack', 'Smash', 'Sweep', 'Ranged', 'Defend', 'Counter', 'Spell', 'Casting', 'Preparing']);
export const HIDDEN_INTENT_LABELS = Object.freeze(['?', 'Attack?', 'Magic?', 'Preparing?']);
const nonnegative = value => Number.isFinite(value) ? Math.max(0, value) : 0;
export function identificationChance(rules, attributes = {}, level = 1, perception = 0, kind = 'Exact') {
  const row = rules.reads;
  const value = row[`base${kind}`] + nonnegative(attributes.wisdom) * row[`wisdom${kind}`]
    + nonnegative(attributes.intelligence) * row[`intelligence${kind}`]
    + Math.max(0, nonnegative(level) - 1) * row[`level${kind}`] + nonnegative(perception) * row[`perception${kind}`];
  return Math.max(row[`minimum${kind}`], Math.min(row[`maximum${kind}`], value));
}
export function predictionCategory(intent = {}, profile = intent.profile || {}, { charging = false } = {}) {
  if (intent.kind === 'staggered') return 'Staggered';
  const maneuver = profile.maneuver || intent.maneuver;
  if (maneuver === 'defend' || ['block', 'defend'].includes(intent.kind)) return 'Defend';
  if (maneuver === 'counter' || intent.kind === 'counter') return 'Counter';
  if (charging || intent.kind === 'casting') return 'Casting';
  if (['spell', 'spells', 'magic'].includes(profile.camp)) return 'Spell';
  const physical = { attack: 'Attack', smash: 'Smash', sweep: 'Sweep', ranged: 'Ranged' };
  if (Object.hasOwn(physical, maneuver)) return physical[maneuver];
  if (['attack', 'attackDebuff'].includes(intent.kind)) return 'Attack';
  return 'Preparing';
}
export function broadIntentLabel(category) {
  if (['Attack', 'Smash', 'Sweep', 'Ranged'].includes(category)) return 'Attack?';
  return category === 'Spell' ? 'Magic?' : 'Preparing?';
}
export function rollKnowledgeRead(rng, rules, observer, category, { ctx = null, target = {} } = {}) {
  if (fixCoreEnabled(ctx)) {
    const cfg = fixCoreRules(ctx).perception;
    const roll = 1 + Math.floor(rng.float('enemyIntentVisibility') * 20);
    // Keep the legacy clue stream deterministic without exposing a failed exact check.
    rng.float('enemyIntentClue');
    const wisdom = Number(observer.attributes?.wisdom) || 0;
    const level = Number(target.level?.level ?? target.level) || cfg.levelBaseline;
    const intelligence = Number(target.attributes?.intelligence) || cfg.intelligenceBaseline;
    const dc = cfg.baseDC + Math.max(0, level - cfg.levelBaseline) * cfg.levelWeight
      + Math.max(0, intelligence - cfg.intelligenceBaseline) * cfg.intelligenceWeight;
    const total = roll + wisdom, passed = total >= dc;
    return {visibility:passed ? 'exact' : 'unknown',label:passed ? null : '?',
      perception:{roll,wisdom,dc,total,passed},prediction:null,resolved:false,correct:null,credited:false};
  }
  // Both draws are unconditional; an exact success never shifts future clues.
  const exact = rng.float('enemyIntentVisibility');
  const clue = rng.float('enemyIntentClue');
  const args = [rules, observer.attributes, observer.level, observer.perception];
  const visibility = category === 'Staggered' || exact < identificationChance(...args) ? 'exact'
    : clue < identificationChance(...args, 'Clue') ? 'clue' : 'unknown';
  return { visibility, label: visibility === 'unknown' ? '?' : visibility === 'clue' ? broadIntentLabel(category) : null,
    prediction: null, resolved: false, correct: null, credited: false };
}
export function concealKnowledgeIntent(read, serial) {
  const label = read?.visibility === 'clue' && HIDDEN_INTENT_LABELS.includes(read.label) ? read.label : '?';
  return { kind: 'unknown', hidden: true, revealed: false, stance: 'unknown', moveId: null,
    label, knowledgeRead: read?.visibility === 'clue' ? 'clue' : 'unknown', actionSerial: serial };
}
