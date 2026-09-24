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

/**
 * handRulesRows(attributes) → the settings rows for every hand rule.
 *
 * Filed under Advanced → Stats → Draw & hand, beside the Draw conversion, so
 * everything that decides how many cards you hold is edited in one place
 * (owner, 2026-09-21). `settingSection` names the subsection each row is drawn
 * under, and the rows are pushed in the order a turn reads them — opening
 * hand, turn draws, capacity, then what happens to unplayed cards — so each
 * subsection is one unbroken run of rows (tests/hand-rules.test.mjs).
 */
export function handRulesRows(attributes = [], classes = []) {
  const rows = [];
  const add = (path, def, label, topic, extra = {}) => rows.push({
    cat: 'Advanced', advancedGroup: 'Stats', handTopic: topic, settingSection: topic,
    key: HAND_RULES_PREFIX + path, def, label,
    note: '',
    ...(typeof def === 'number' ? { type: 'number', integer: true, step: 1, min: 0, max: 99 } : {}), ...extra,
  });
  const addGroupRows = (group) => {
    const topic = groups[group];
    const subject = group === 'capacity' ? 'hand capacity' : group === 'starting' ? 'opening hand' : 'turn draw';
    // Three groups share one topic, so each label names its group: a search
    // that finds all three still tells them apart.
    const Subject = subject[0].toUpperCase() + subject.slice(1);
    const labels = {
      base: `${Subject} — Base cards`,
      statEnabled: `${Subject} — Grow with an attribute`,
      stat: `${Subject} — Attribute used`,
      baseline: `${Subject} — Attribute points before bonuses`,
      pointsPerCard: `${Subject} — Attribute points per extra card`,
      minimum: `${Subject} — Never fewer than`,
      maximum: `${Subject} — Never more than`,
    };
    for (const [field, def] of Object.entries(handRulesDefaults[group])) {
      const extra = {};
      if (field === 'stat') Object.assign(extra, { type: 'choice', choices: attributes.map(a => a.id), choiceLabels: Object.fromEntries(attributes.map(a => [a.id, `${a.label} (${a.shortLabel})`])) });
      if (field === 'pointsPerCard') extra.min = 1;
      if (group === 'capacity' && ['base', 'minimum', 'maximum'].includes(field)) extra.min = 1;
      if (['stat', 'baseline', 'pointsPerCard'].includes(field)) extra.requires = [group + '.statEnabled', true];
      if (group === 'turn') extra.fixedOnly = true;
      // EVERY SHIPPED CLASS OPENS ON ITS OWN BASE AND ATTRIBUTE (owner,
      // 2026-09-24), set by the per-class rows below, so the shared pair moved
      // nothing a player can reach. The keys stay so an exported configuration
      // still imports; the rows leave the screen (`retired`), the way a
      // retired creation mode's dials do.
      if (group === 'starting' && ['base', 'stat'].includes(field)) Object.assign(extra, { retired: true, inert: true });
      if (field === 'base') extra.note = `The ${subject} before any attribute bonus.`;
      if (field === 'statEnabled') extra.note = `On: the attribute below adds cards to the ${subject}. Off: only the base and the limits apply.`;
      if (field === 'stat') extra.note = `The attribute that adds cards to the ${subject}.`;
      if (field === 'baseline') extra.note = 'Only points above this value earn extra cards. Lower attributes never remove cards.';
      if (field === 'pointsPerCard') extra.note = 'Lower is faster. Extra cards = floor((attribute − points before bonuses) ÷ this).';
      if (field === 'minimum') extra.note = `The ${subject} never drops below this.`;
      if (field === 'maximum') extra.note = `The ${subject} never rises above this, whatever the attribute.`;
      add(`${group}.${field}`, def, labels[field], topic, extra);
    }
  };
  addGroupRows('starting');
  // ONE ROW PAIR PER CLASS, beside the shared opening-hand rows they refine.
  const classNames = Object.fromEntries((classes || []).map((row) => [row.id, row.name || row.id]));
  for (const [classId, def] of Object.entries(handRulesDefaults.startingByClass || {})) {
    const name = classNames[classId] || classId[0].toUpperCase() + classId.slice(1);
    add(`startingByClass.${classId}.base`, def.base, `${name} — Opening hand base cards`, groups.starting, {
      note: `The ${name}'s opening hand before any attribute bonus. The attribute below adds cards on top, within the opening-hand limits above.`,
    });
    add(`startingByClass.${classId}.stat`, def.stat, `${name} — Opening hand attribute`, groups.starting, {
      type: 'choice', choices: attributes.map(a => a.id),
      choiceLabels: Object.fromEntries(attributes.map(a => [a.id, `${a.label} (${a.shortLabel})`])),
      requires: ['starting.statEnabled', true],
      note: `The attribute that adds cards to the ${name}'s opening hand.`,
    });
  }
  add('drawMode', handRulesDefaults.drawMode, 'How cards are drawn each turn', groups.turn, {
    type: 'choice', dropdown: true, choices: ['fill', 'fixed'],
    choiceLabels: { fill: 'Fill up to hand capacity', fixed: 'Draw a fixed number' },
    note: 'Fill draws until your hand reaches capacity. Fixed draws the turn amount below, never past capacity.',
  });
  add('reshuffle', true, 'Reshuffle when empty', groups.turn, { note: 'Shuffle the discard pile back into the draw pile when it runs out.' });
  addGroupRows('turn');
  addGroupRows('capacity');
  add('overflow', handRulesDefaults.overflow, 'When your hand is over capacity', groups.capacity, {
    type: 'choice', dropdown: true, choices: ['keep', 'discard'],
    choiceLabels: { keep: 'Keep cards; stop drawing', discard: 'Discard excess at turn end' },
    note: 'Whether retained cards past capacity stay (and block draws) or are discarded at turn end.',
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
    note: 'Caps only the optional turn-end discard. Discards forced by capacity can exceed it.',
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
    parts.reduce((node, part) => node[part], rules)[field] = value;
  }
  for (const group of Object.keys(groups)) if (rules[group].minimum > rules[group].maximum) rules[group] = structuredClone(handRulesDefaults[group]);
  return rules;
}

/**
 * handRulesForClass(rules, classId) → the rules one fight is handed.
 *
 * The class's own opening-hand row replaces `starting.base` and
 * `starting.stat`; the per-class table itself does not ride into the fight,
 * so the combat snapshot states exactly the opening hand that fight was born
 * with and a saved fight keeps it whatever the table later becomes. A class
 * with no row (or no class at all: a headless fixture) keeps the shared rule.
 */
export function handRulesForClass(rules, classId = null) {
  const { startingByClass, ...fight } = structuredClone(rules);
  const own = classId && startingByClass ? startingByClass[classId] : null;
  if (own) fight.starting = { ...fight.starting, base: own.base, stat: own.stat };
  return fight;
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
 * character drew the cards of a 35-point one and the old hand summary — which
 * never passed the argument — described a hand the engine did not deal. One
 * reading of an attribute, one hand size.
 */
export function scaledCards(rule, attributes = {}) {
  return scaledCardsReceipt(rule, attributes).value;
}

/** scaledCardsReceipt(rule, attributes) → every term `scaledCards` used, for a worked example. */
export function scaledCardsReceipt(rule, attributes = {}) {
  const points = Number(attributes?.[rule.stat]) || 0;
  const bonus = rule.statEnabled ? Math.floor(Math.max(0, points - rule.baseline) / rule.pointsPerCard) : 0;
  const raw = rule.base + bonus;
  return {
    stat: rule.stat, statEnabled: rule.statEnabled, points, baseline: rule.baseline, pointsPerCard: rule.pointsPerCard,
    base: rule.base, bonus, raw, minimum: rule.minimum, maximum: rule.maximum,
    value: Math.min(rule.maximum, Math.max(rule.minimum, raw)),
  };
}
