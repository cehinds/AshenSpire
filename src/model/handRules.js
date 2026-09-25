import { handRulesDefaults } from '../content/handRules.js';
import { HAND_STAT_IDS } from './derivedStats.js';
import { HAND_GROUP_ROWS, isLegacyHandGroup, legacyHandRow, statRowCount } from './statRows.js';

export const HAND_RULES_PREFIX = 'gameConfig.handRules.';
const groups = { starting: 'Starting hand', turn: 'Turn draws', capacity: 'Hand capacity' };
const ATTRIBUTE_IDS = ['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence'];

// A FIGHT'S HAND RULES are the behaviour options above plus the three ROWS it
// counts cards by (`rows: { openingHand, draw, handSize }`), copied from the
// run's own stat rows when the fight opens. A fight saved before ruleset 7
// carries the retired single-stat groups (`starting`, `turn`, `capacity`)
// instead; `handRow` reads either, so an old save counts exactly as it did.

function legacyGroupProblems(rules, problems) {
  for (const group of Object.keys(groups)) {
    const rule = rules[group];
    if (!rule || typeof rule !== 'object') { problems.push(`Hand rules: missing ${group}`); continue; }
    if (typeof rule.statEnabled !== 'boolean' || !ATTRIBUTE_IDS.includes(rule.stat)) problems.push(`Hand rules: invalid ${group} stat`);
    for (const key of ['base', 'baseline', 'pointsPerCard', 'minimum', 'maximum']) {
      const min = key === 'pointsPerCard' || (group === 'capacity' && ['base', 'minimum', 'maximum'].includes(key)) ? 1 : 0;
      if (!Number.isInteger(rule[key]) || rule[key] < min || rule[key] > 99) problems.push(`Hand rules: invalid ${group}.${key}`);
    }
    if (rule.minimum > rule.maximum) problems.push(`Hand rules: ${group} minimum must not exceed maximum`);
  }
}

function rowProblems(rows, problems) {
  if (!rows || typeof rows !== 'object') { problems.push('Hand rules: missing rows'); return; }
  for (const id of HAND_STAT_IDS) {
    const row = rows[id];
    if (!row || typeof row !== 'object') { problems.push(`Hand rules: missing ${id} row`); continue; }
    if (!Number.isFinite(row.base) || row.base < 0) problems.push(`Hand rules: invalid ${id}.base`);
    for (const key of [...ATTRIBUTE_IDS, 'perLevel']) {
      if (row[key] !== undefined && (!Number.isFinite(row[key]) || row[key] < 0)) problems.push(`Hand rules: invalid ${id}.${key}`);
    }
    for (const key of ['min', 'max']) {
      if (row[key] !== undefined && row[key] !== null && (!Number.isInteger(row[key]) || row[key] < 0)) problems.push(`Hand rules: invalid ${id}.${key}`);
    }
    if (Number.isInteger(row.min) && Number.isInteger(row.max) && row.min > row.max) problems.push(`Hand rules: ${id} min must not exceed max`);
    // A hand holds at least one card, at the fight door as at the content and
    // settings doors (model/derivedStats.js), or a resumed fight deals nothing.
    if (id === 'handSize' && (!Number.isInteger(row.min) || row.min < 1 || (Number.isInteger(row.max) && row.max < 1))) {
      problems.push('Hand rules: handSize min and max must each be at least 1');
    }
  }
}

export function handRulesProblems(rules) {
  if (!rules || typeof rules !== 'object') return ['Hand rules must be an object'];
  const problems = [];
  for (const key of ['retain', 'promptDiscard', 'replaceDiscards', 'reshuffle']) if (typeof rules[key] !== 'boolean') problems.push(`Hand rules: ${key} must be boolean`);
  if (!['fill', 'fixed'].includes(rules.drawMode) || !['keep', 'discard'].includes(rules.overflow)) problems.push('Hand rules: invalid draw or overflow mode');
  if (!Number.isInteger(rules.discardLimit) || rules.discardLimit < 0 || rules.discardLimit > 99) problems.push('Hand rules: invalid discard limit');
  if (rules.rows !== undefined) rowProblems(rules.rows, problems);
  else legacyGroupProblems(rules, problems);
  return problems;
}

/**
 * handRulesRows() → the settings rows for how a hand BEHAVES.
 *
 * Filed under Advanced → Stats → Draw & hand, beside the Opening hand, Draw /
 * turn and Hand size stat rows, so everything that decides the cards you hold
 * is edited in one place. `settingSection` names the subsection each row is
 * drawn under (tests/hand-rules.test.mjs).
 */
export function handRulesRows() {
  const rows = [];
  const add = (path, def, label, topic, extra = {}) => rows.push({
    cat: 'Advanced', advancedGroup: 'Stats', handTopic: topic, settingSection: topic,
    key: HAND_RULES_PREFIX + path, def, label,
    note: '',
    ...(typeof def === 'number' ? { type: 'number', integer: true, step: 1, min: 0, max: 99 } : {}), ...extra,
  });
  add('drawMode', handRulesDefaults.drawMode, 'How cards are drawn each turn', groups.turn, {
    type: 'choice', dropdown: true, choices: ['fill', 'fixed'],
    choiceLabels: { fill: 'Fill up to hand size', fixed: 'Draw a fixed number' },
    note: 'Fill draws until your hand reaches its hand size. Fixed draws the Draw / turn row, never past the hand size.',
  });
  add('reshuffle', true, 'Reshuffle when empty', groups.turn, { note: 'Shuffle the discard pile back into the draw pile when it runs out.' });
  add('overflow', handRulesDefaults.overflow, 'When your hand is over its size', groups.capacity, {
    type: 'choice', dropdown: true, choices: ['keep', 'discard'],
    choiceLabels: { keep: 'Keep cards; stop drawing', discard: 'Discard excess at turn end' },
    note: 'Whether retained cards past the hand size stay (and block draws) or are discarded at turn end.',
  });
  add('retain', handRulesDefaults.retain, 'Keep unplayed cards after your turn', 'Retention & discards', {
    note: 'On: cards you do not play stay in hand. Off: they go to the discard pile at turn end.',
  });
  add('promptDiscard', false, 'Offer optional discards at turn end', 'Retention & discards', {
    requires: ['retain', true],
    note: 'While cards are kept, pause at turn end so you can discard the ones you do not want.',
  });
  add('discardLimit', 10, 'Most cards you may discard by choice', 'Retention & discards', {
    requires: ['promptDiscard', true],
    note: 'Caps only the optional turn-end discard. Discards forced by the hand size can exceed it.',
  });
  add('replaceDiscards', false, 'Replace optional discards next turn', 'Retention & discards', {
    requires: ['promptDiscard', true],
    note: 'Adds replacements to fixed draws, still capped by the hand size. Fill mode already refills the hand.',
  });
  return rows;
}

/**
 * resolveHandRules(settings, rows) → a fight's hand rules: the behaviour
 * options from settings, and the three count rows the caller read for this
 * run (model/statRows.js handStatRows).
 */
export function resolveHandRules(settings = {}, rows = null) {
  const rules = structuredClone(handRulesDefaults);
  for (const row of handRulesRows()) {
    const raw = settings[row.key];
    if (raw === undefined) continue;
    let value;
    if (row.type === 'choice') { if (!row.choices.includes(raw)) continue; value = raw; }
    else if (typeof row.def === 'boolean') { if (typeof raw !== 'boolean') continue; value = raw; }
    else { if (!Number.isFinite(Number(raw))) continue; value = Math.min(row.max, Math.max(row.min, Math.floor(Number(raw)))); }
    rules[row.key.slice(HAND_RULES_PREFIX.length)] = value;
  }
  if (rows) rules.rows = structuredClone(rows);
  return rules;
}

/** The settings-level problems the hand rows can have (none since ruleset 7: a row's own min/max is checked with the row). */
export function handRulesSettingsProblems() {
  return [];
}

/**
 * handRow(rules, id) → the row a fight counts `id` ('openingHand' | 'draw' |
 * 'handSize') by — its own row, or a saved fight's retired group restated.
 */
export function handRow(rules, id) {
  if (rules?.rows?.[id]) return rules.rows[id];
  const group = Object.keys(HAND_GROUP_ROWS).find((key) => HAND_GROUP_ROWS[key] === id);
  const legacy = group && rules?.[group];
  if (legacy) return isLegacyHandGroup(legacy) ? legacyHandRow(legacy) : legacy;
  throw new Error(`Hand rules carry no ${id} row`);
}

/**
 * scaledCards(row, attributes, level) → the card count this row states.
 *
 * THE ATTRIBUTE ARRIVES AS THE SHEET SHOWS IT (owner, 2026-09-21), and since
 * ruleset 7 the count is the ONE row formula every stat uses. A retired
 * single-stat group is read through its exact adapter.
 */
export function scaledCards(rule, attributes = {}, level = undefined) {
  return statRowCount(isLegacyHandGroup(rule) ? legacyHandRow(rule) : rule, attributes, level);
}
