import { handRulesDefaults } from '../content/handRules.js';

export const HAND_RULES_PREFIX = 'gameConfig.handRules.';
const groups = { starting: 'Starting hand', turn: 'Turn draws', capacity: 'Hand capacity' };

export function handRulesProblems(rules) {
  if (!rules || typeof rules !== 'object') return ['Hand rules must be an object'];
  const problems = [];
  for (const key of ['retain', 'promptDiscard', 'replaceDiscards', 'reshuffle']) if (typeof rules[key] !== 'boolean') problems.push(`Hand rules: ${key} must be boolean`);
  if (!['fill', 'fixed'].includes(rules.drawMode) || !['keep', 'discard'].includes(rules.overflow)) problems.push('Hand rules: invalid draw or overflow mode');
  if (!Number.isInteger(rules.discardLimit) || rules.discardLimit < 0 || rules.discardLimit > 99) problems.push('Hand rules: invalid discard limit');
  for (const group of Object.keys(groups)) {
    const rule = rules[group];
    if (!rule || typeof rule !== 'object') { problems.push(`Hand rules: missing ${group}`); continue; }
    if (typeof rule.statEnabled !== 'boolean' || !['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence'].includes(rule.stat)) problems.push(`Hand rules: invalid ${group} stat`);
    for (const key of ['base', 'baseline', 'pointsPerCard', 'minimum', 'maximum']) {
      const min = key === 'pointsPerCard' || (group === 'capacity' && ['base', 'minimum', 'maximum'].includes(key)) ? 1 : 0;
      if (!Number.isInteger(rule[key]) || rule[key] < min || rule[key] > 99) problems.push(`Hand rules: invalid ${group}.${key}`);
    }
    if (rule.minimum > rule.maximum) problems.push(`Hand rules: ${group} minimum must not exceed maximum`);
  }
  return problems;
}

export function handRulesRows(attributes = []) {
  const rows = [];
  const add = (path, def, label, topic, extra = {}) => rows.push({
    cat: 'Advanced', advancedGroup: 'Hand & Draw', handTopic: topic,
    key: HAND_RULES_PREFIX + path, def, label,
    note: '',
    ...(typeof def === 'number' ? { type: 'number', integer: true, step: 1, min: 0, max: 99 } : {}), ...extra,
  });
  add('retain', handRulesDefaults.retain, 'Retain unplayed cards', 'Retention & discards');
  add('promptDiscard', false, 'Prompt for optional discards', 'Retention & discards', { requires: ['retain', true] });
  add('discardLimit', 10, 'Maximum optional discards per turn', 'Retention & discards', { requires: ['promptDiscard', true] });
  add('replaceDiscards', false, 'Replace optional discards next turn', 'Retention & discards', { requires: ['promptDiscard', true], note: 'Adds replacements to fixed draws, still capped by hand capacity. Fill mode already refills the hand.' });
  add('overflow', 'keep', 'When hand exceeds capacity', 'Hand capacity', { type: 'choice', dropdown: true, choices: ['keep', 'discard'], choiceLabels: { keep: 'Keep cards; stop drawing', discard: 'Discard excess at turn end' } });
  add('reshuffle', true, 'Reshuffle when empty', 'Turn draws', { note: 'Shuffle the discard pile back into the draw pile when needed.' });
  add('drawMode', 'fill', 'Draw mode', 'Turn draws', { type: 'choice', dropdown: true, choices: ['fill', 'fixed'], choiceLabels: { fill: 'Fill hand', fixed: 'Fixed draw' } });
  for (const [group, topic] of Object.entries(groups)) {
    const labels = { base: group === 'capacity' ? 'Base hand capacity' : group === 'starting' ? 'Base starting draw' : 'Base cards drawn per turn', statEnabled: 'Enable stat scaling', stat: 'Scaling stat', baseline: 'Stat baseline', pointsPerCard: 'Stat points per additional card', minimum: 'Minimum cards', maximum: 'Maximum cards' };
    for (const [field, def] of Object.entries(handRulesDefaults[group])) {
      const extra = {};
      if (field === 'stat') Object.assign(extra, { type: 'choice', choices: attributes.map(a => a.id), choiceLabels: Object.fromEntries(attributes.map(a => [a.id, `${a.label} (${a.shortLabel})`])) });
      if (field === 'pointsPerCard') extra.min = 1;
      if (group === 'capacity' && ['base', 'minimum', 'maximum'].includes(field)) extra.min = 1;
      if (['stat', 'baseline', 'pointsPerCard'].includes(field)) extra.requires = [group + '.statEnabled', true];
      if (group === 'turn') extra.fixedOnly = true;
      if (field === 'baseline') extra.note = 'Only points above this value earn bonus cards. Lower stats never subtract cards.';
      if (field === 'pointsPerCard') extra.note = 'Whole intervals only: floor((stat − baseline) ÷ points per card).';
      add(`${group}.${field}`, def, labels[field], topic, extra);
    }
  }
  return rows;
}

export function resolveHandRules(settings = {}, attributes = []) {
  const rules = structuredClone(handRulesDefaults);
  for (const row of handRulesRows(attributes)) {
    const raw = settings[row.key];
    if (raw === undefined) continue;
    let value;
    if (row.type === 'choice') { if (!row.choices.includes(raw)) continue; value = raw; }
    else if (typeof row.def === 'boolean') { if (typeof raw !== 'boolean') continue; value = raw; }
    else { if (!Number.isFinite(Number(raw))) continue; value = Math.min(row.max, Math.max(row.min, Math.floor(Number(raw)))); }
    const parts = row.key.slice(HAND_RULES_PREFIX.length).split('.');
    const field = parts.pop();
    (parts.length ? rules[parts[0]] : rules)[field] = value;
  }
  for (const group of Object.keys(groups)) if (rules[group].minimum > rules[group].maximum) rules[group] = structuredClone(handRulesDefaults[group]);
  return rules;
}

export function handRulesSettingsProblems(settings = {}) {
  return Object.entries(groups).flatMap(([group, label]) => {
    const min = settings[HAND_RULES_PREFIX + group + '.minimum'] ?? handRulesDefaults[group].minimum;
    const max = settings[HAND_RULES_PREFIX + group + '.maximum'] ?? handRulesDefaults[group].maximum;
    return min > max ? [`${label}: minimum must not exceed maximum. Default ${label.toLowerCase()} rules apply until corrected.`] : [];
  });
}

export function scaledCards(rule, attributes = {}, statScale = 1) {
  const bonus = rule.statEnabled ? Math.floor(Math.max(0, (attributes?.[rule.stat] || 0) / statScale - rule.baseline) / rule.pointsPerCard) : 0;
  return Math.min(rule.maximum, Math.max(rule.minimum, rule.base + bonus));
}

export function handRuleSummary(rules, attributes = {}) {
  const capacity = scaledCards(rules.capacity, attributes);
  const opening = Math.min(capacity, scaledCards(rules.starting, attributes));
  const turn = rules.drawMode === 'fill' ? 'Fill to capacity each turn' : `Draw up to ${scaledCards(rules.turn, attributes)} each turn`;
  return `${opening} starting cards · ${capacity} maximum · ${turn}. ${rules.retain ? 'Keep unplayed cards.' : 'Discard unplayed cards.'}${rules.retain && rules.promptDiscard ? ' Choose optional discards at turn end.' : ''}`;
}
