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
    cat: 'Advanced', advancedGroup: 'Stats', handTopic: topic,
    settingSection: topic,
    key: HAND_RULES_PREFIX + path, def, label,
    note: 'Controls how cards move through your hand during combat.',
    ...(typeof def === 'number' ? { type: 'number', integer: true, step: 1, min: 0, max: 99 } : {}), ...extra,
  });
  const addGroupRows = (group, topic) => {
    const subject = group === 'capacity' ? 'hand capacity' : group === 'starting' ? 'opening hand' : 'turn draw';
    const labelSubject = subject[0].toUpperCase() + subject.slice(1);
    const labels = {
      base: group === 'capacity' ? 'Base hand capacity' : group === 'starting' ? 'Base opening hand' : 'Base cards drawn per turn',
      statEnabled: `Scale ${subject} from an attribute`,
      stat: `${labelSubject} — attribute used for scaling`,
      baseline: `${labelSubject} — attribute points before bonuses begin`,
      pointsPerCard: `${labelSubject} — attribute points per extra card`,
      minimum: `${labelSubject} — minimum cards`,
      maximum: `${labelSubject} — maximum cards`,
    };
    for (const [field, def] of Object.entries(handRulesDefaults[group])) {
      const extra = {};
      if (field === 'stat') Object.assign(extra, { type: 'choice', choices: attributes.map(a => a.id), choiceLabels: Object.fromEntries(attributes.map(a => [a.id, `${a.label} (${a.shortLabel})`])) });
      if (field === 'pointsPerCard') extra.min = 1;
      if (group === 'capacity' && ['base', 'minimum', 'maximum'].includes(field)) extra.min = 1;
      if (['stat', 'baseline', 'pointsPerCard'].includes(field)) extra.requires = [group + '.statEnabled', true];
      if (group === 'turn') extra.fixedOnly = true;
      if (field === 'base') extra.note = `The ${subject} before attribute bonuses.`;
      if (field === 'statEnabled') extra.note = `On: the chosen attribute can add cards to the ${subject}. Off: only the base and limits apply.`;
      if (field === 'stat') extra.note = `The character attribute that can add cards to the ${subject}.`;
      if (field === 'baseline') extra.note = 'Only points above this value earn bonus cards. Lower stats never subtract cards.';
      if (field === 'pointsPerCard') extra.note = 'Lower values award cards faster. Whole intervals only: floor((attribute − baseline) ÷ points per card).';
      if (field === 'minimum') extra.note = `The ${subject} never falls below this amount, even when its base is lower.`;
      if (field === 'maximum') extra.note = `The ${subject} never rises above this amount, even after attribute bonuses.`;
      add(`${group}.${field}`, def, labels[field], topic, extra);
    }
  };

  addGroupRows('starting', groups.starting);
  add('drawMode', 'fill', 'How cards are drawn each turn', groups.turn, {
    type: 'choice',
    dropdown: true,
    choices: ['fill', 'fixed'],
    choiceLabels: { fill: 'Fill to hand capacity', fixed: 'Draw a fixed number' },
    note: 'Fill draws until your hand reaches its capacity. Fixed draws the calculated turn amount, without exceeding capacity.',
  });
  add('reshuffle', true, 'Reshuffle when empty', groups.turn, {
    note: 'Shuffle the discard pile back into the draw pile when needed.',
  });
  addGroupRows('turn', groups.turn);
  addGroupRows('capacity', groups.capacity);
  add('overflow', 'keep', 'When your hand is over capacity', groups.capacity, {
    type: 'choice',
    dropdown: true,
    choices: ['keep', 'discard'],
    choiceLabels: { keep: 'Keep cards; stop drawing', discard: 'Discard excess at turn end' },
    note: 'Choose whether excess retained cards stay and prevent more draws, or must be discarded at turn end.',
  });
  add('retain', handRulesDefaults.retain, 'Keep unplayed cards after your turn', 'Retention & discards', {
    note: 'On: cards you do not play stay in hand. Off: ordinary unplayed cards go to the discard pile at turn end.',
  });
  add('promptDiscard', false, 'Offer optional discards at turn end', 'Retention & discards', {
    requires: ['retain', true],
    note: 'When cards are retained, pause at turn end so you may discard unwanted cards before the next draw.',
  });
  add('discardLimit', 10, 'Most cards you may discard voluntarily', 'Retention & discards', {
    requires: ['promptDiscard', true],
    note: 'Caps only optional turn-end discards. Forced overflow discards may still require more.',
  });
  add('replaceDiscards', false, 'Replace optional discards next turn', 'Retention & discards', {
    requires: ['promptDiscard', true],
    note: 'Adds replacements to fixed draws, still capped by hand capacity. Fill mode already refills the hand.',
  });
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

/**
 * scaledCards(rule, attributes) → the card count this rule states.
 *
 * THE ATTRIBUTE ARRIVES AS THE SHEET SHOWS IT (owner, 2026-09-21). A third
 * argument used to divide it by the creation-scale ratio, so a 12-point
 * character drew the cards of a 35-point one and `handRuleSummary` — which
 * never passed the argument — described a hand the engine did not deal. One
 * reading of an attribute, one hand size.
 */
export function scaledCards(rule, attributes = {}) {
  return scaledCardsReceipt(rule, attributes).value;
}

export function scaledCardsReceipt(rule, attributes = {}) {
  const points = Number(attributes?.[rule.stat]) || 0;
  const eligible = Math.max(0, points - rule.baseline);
  const bonus = rule.statEnabled ? Math.floor(eligible / rule.pointsPerCard) : 0;
  const raw = rule.base + bonus;
  const value = Math.min(rule.maximum, Math.max(rule.minimum, raw));
  return {
    stat: rule.stat,
    points,
    baseline: rule.baseline,
    pointsPerCard: rule.pointsPerCard,
    base: rule.base,
    bonus,
    raw,
    minimum: rule.minimum,
    maximum: rule.maximum,
    statEnabled: rule.statEnabled,
    value,
  };
}

export function handRuleSummary(rules, attributes = {}) {
  const capacity = scaledCards(rules.capacity, attributes);
  const opening = Math.min(capacity, scaledCards(rules.starting, attributes));
  const turn = rules.drawMode === 'fill' ? 'Fill to capacity each turn' : `Draw up to ${scaledCards(rules.turn, attributes)} each turn`;
  return `${opening} starting cards · ${capacity} maximum · ${turn}. ${rules.retain ? 'Keep unplayed cards.' : 'Discard unplayed cards.'}${rules.retain && rules.promptDiscard ? ' Choose optional discards at turn end.' : ''}`;
}
