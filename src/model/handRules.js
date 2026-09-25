import { handRulesDefaults } from '../content/handRules.js';

export const HAND_RULES_PREFIX = 'gameConfig.handRules.';
/** The shared opening-hand fields every class now sets for itself: no row, no setting. */
export const RETIRED_SHARED_OPENING_FIELDS = Object.freeze(['base', 'stat']);
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
      // 2026-09-24), set by the per-class rows below, so the shared pair has
      // no row: nothing a player can reach reads it. A profile, run snapshot
      // or imported file that still carries either key has it DROPPED, with
      // a warning when it was not the stock value (`withoutRetiredOpeningHand`
      // below) — never migrated onto every class, which would flatten the
      // four openings into one (Codex, #1294).
      if (group === 'starting' && RETIRED_SHARED_OPENING_FIELDS.includes(field)) continue;
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
  // ONE ROW PAIR PER CLASS, beside the shared opening-hand limits they sit within.
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
 * The class's own opening-hand row supplies `starting.base` and
 * `starting.stat`; the per-class table itself does not ride into the fight,
 * so the combat snapshot states exactly the opening hand that fight was born
 * with and a saved fight keeps it whatever the table later becomes. A class
 * with no row (or no class at all: a headless fixture) keeps the authored
 * fallback in `handRulesDefaults.starting` — no setting reaches it, because
 * the shared `starting.base` / `starting.stat` keys are retired and
 * `resolveHandRules` no longer reads them (Codex, #1294).
 */
export function handRulesForClass(rules, classId = null) {
  const { startingByClass, ...fight } = structuredClone(rules);
  const own = classId && startingByClass ? startingByClass[classId] : null;
  if (own) fight.starting = { ...fight.starting, base: own.base, stat: own.stat };
  return fight;
}

// THE OPENING-HAND LIMITS BEFORE 2026-09-24 WERE 3–15 (owner, 2026-09-24:
// "start with 4-6 cards"). The Advanced panel stores — and an export writes —
// every value it holds, so a profile or file from before the change pins the
// old default cap of 15, and with it every opening hand above the 4–6 he asked
// for. A stored or imported `starting.maximum` of exactly 15 is that retired
// default, so it is DROPPED with a warning and the current default applies;
// the `starting.minimum` of 3 riding beside it is the other half of the same
// retired pair and goes with it (a floor of 3 would open an all-1s Reaver on
// 3). A lone minimum of 3, with no 15 beside it, is somebody's choice and
// stays; once the 15 is gone the check never fires again. A deliberate 15 is
// indistinguishable from the old default and is dropped too — the price of
// reading intent from a value. Run snapshots keep their limits: a fight keeps
// the hand it was born with.
//
// THE SHARED OPENING BASE AND ATTRIBUTE ARE RETIRED TOO (owner, 2026-09-24:
// every class opens on its own — Reaver 3 STR, Rogue 4 DEX, Herald 4 WIS,
// Starseer 5 INT). `starting.base` / `.stat` have no row (RETIRED_SHARED_
// OPENING_FIELDS); they used to be accepted and then overwritten by every
// class's row, so an imported customisation "succeeded" and the next fight
// ignored it (Codex, #1294). They are DROPPED through this same door at every
// entrance — profile, run snapshot (nothing reads them there either) and
// imported file — never migrated onto every class, which would flatten the
// four openings into one. The warning is said only when the value was not a
// stock one: an export writes every value, and a stock value was never a
// customisation. Stock is any default the shared pair ever shipped with — base
// 3 (before b9bdfcd7) or 4 (now), attribute INT — compared loosely, so a "4"
// typed into a hand-edited file is as quiet as a 4. Both drops share ONE
// warning.
const OPENING_MAXIMUM_KEY = `${HAND_RULES_PREFIX}starting.maximum`;
const OPENING_MINIMUM_KEY = `${HAND_RULES_PREFIX}starting.minimum`;
const RETIRED_OPENING_MAXIMUM = 15;
const RETIRED_OPENING_MINIMUM = 3;
const SHARED_OPENING_DEFAULTS = Object.freeze(Object.fromEntries(RETIRED_SHARED_OPENING_FIELDS
  .map((field) => [`${HAND_RULES_PREFIX}starting.${field}`, handRulesDefaults.starting[field]])));
const bareKey = (key) => (key.startsWith('settings.') ? key.slice('settings.'.length) : key);
const sharedOpening = ([key]) => Object.hasOwn(SHARED_OPENING_DEFAULTS, bareKey(key));
const STOCK_SHARED_OPENING_BASES = Object.freeze([3, handRulesDefaults.starting.base]);
const stockSharedOpening = ([key, value]) => (bareKey(key).endsWith('.base')
  ? STOCK_SHARED_OPENING_BASES.includes(Number(value))
  : String(value) === String(SHARED_OPENING_DEFAULTS[bareKey(key)]));

/**
 * True when a stored profile pins the retired opening-hand cap of 15, or holds
 * the retired shared opening base or attribute — each in either spelling
 * (plain or `settings.`-prefixed), the same keys `withoutRetiredOpeningHand`
 * drops (Codex, on #1318).
 */
export function hasRetiredOpeningHand(settings = {}) {
  return Object.entries(settings || {}).some(([key, value]) => sharedOpening([key])
    || (bareKey(key) === OPENING_MAXIMUM_KEY && value === RETIRED_OPENING_MAXIMUM));
}

/**
 * withoutRetiredOpeningHand(entries, warnings, { limits }) → entries without
 * the retired 3–15 opening-hand limits (unless `limits` is false: a run
 * snapshot) and without the shared opening base and attribute, each in either
 * spelling (plain or `settings.`-prefixed), with at most one warning.
 */
export function withoutRetiredOpeningHand(entries, warnings = null, { limits = true } = {}) {
  const retiredMaximum = ([key, value]) => bareKey(key) === OPENING_MAXIMUM_KEY && value === RETIRED_OPENING_MAXIMUM;
  const retiredMinimum = ([key, value]) => bareKey(key) === OPENING_MINIMUM_KEY && value === RETIRED_OPENING_MINIMUM;
  const dropsLimits = limits && entries.some(retiredMaximum);
  const shared = entries.filter(sharedOpening);
  if (!dropsLimits && !shared.length) return entries;
  if (Array.isArray(warnings)) {
    const said = [];
    if (dropsLimits) {
      const dropsMinimum = entries.some(retiredMinimum);
      said.push(`the old limit${dropsMinimum ? 's of 3–15 cards were' : ' of 15 cards was'} left out, so the current ${handRulesDefaults.starting.minimum}–${handRulesDefaults.starting.maximum} applies`);
    }
    if (shared.some((entry) => !stockSharedOpening(entry))) {
      said.push('the shared base cards and attribute are retired and were left out: each class opens on its own. Use Stats → Draw & hand → each class\'s Opening hand base cards and Opening hand attribute');
    }
    if (said.length) warnings.push(`Opening hand: ${said.join('; ')}. Everything else was kept.`);
  }
  return entries.filter((entry) => !sharedOpening(entry) && !(dropsLimits && (retiredMaximum(entry) || retiredMinimum(entry))));
}

/**
 * classHandRules(settings, attributes, classId) → the hand rules a fight of
 * this class is handed under these settings. The ONE door: combat
 * (engine/runCombat.js) snapshots it, and character creation's Hand and Draw
 * chips read it, so the hand a new character is promised is the hand its
 * first fight deals (Codex, #1294).
 */
export function classHandRules(settings = {}, attributes = [], classId = null) {
  return handRulesForClass(resolveHandRules(settings || {}, attributes), classId);
}

/**
 * handDrawCount(rules, attributes, { handSize, opening, replacements }) → how
 * many cards one draw puts into a hand already holding `handSize`: the
 * starting rule on the opening draw, otherwise the fixed turn rule (plus any
 * replacements for chosen discards) or a fill to capacity — never more than
 * the room capacity leaves. The ONE formula: combat's `turnDrawCount`
 * (engine/handRules.js) deals it and creation's Hand and Draw chips
 * (`handSizeReceipts`) preview it for an empty hand, so a turn draw of 2 into
 * a capacity of 1 reads 1 on both (Codex, #1294).
 */
export function handDrawCount(rules, attributes = {}, { handSize = 0, opening = false, replacements = 0 } = {}) {
  const capacity = scaledCards(rules.capacity, attributes);
  const room = Math.max(0, capacity - handSize);
  const wanted = opening ? scaledCards(rules.starting, attributes)
    : rules.drawMode === 'fill' ? room : scaledCards(rules.turn, attributes) + replacements;
  return { capacity, room, wanted, value: Math.min(room, wanted) };
}

/**
 * handSizeReceipts(rules, attributes) → the opening hand, the most one turn
 * draws, and the capacity, each with the terms `scaledCards` used. Both
 * values are `handDrawCount` into an empty hand — what `turnDrawCount`
 * (engine/handRules.js) deals: the stated rule (`stated`), limited by
 * capacity. A fill draw tops the hand up to capacity.
 */
export function handSizeReceipts(rules, attributes = {}) {
  const capacity = scaledCardsReceipt(rules.capacity, attributes);
  const starting = scaledCardsReceipt(rules.starting, attributes);
  const opening = { ...starting, stated: starting.value, capacity: capacity.value, value: handDrawCount(rules, attributes, { opening: true }).value };
  const most = handDrawCount(rules, attributes).value;
  const turnRule = scaledCardsReceipt(rules.turn, attributes);
  const turn = rules.drawMode === 'fill'
    ? { fill: true, capacity: capacity.value, value: most }
    : { ...turnRule, stated: turnRule.value, fill: false, capacity: capacity.value, value: most };
  return { opening, turn, capacity };
}

/**
 * handRuleFacts(rules, attrId) → what one point of `attrId` buys in the hand
 * these rules deal, as `{ label, points, baseline, maximum }` per hand rule
 * that grows with it (the opening hand first: it is the one a class's own
 * attribute moves). Read by the attribute cards (model/creationBrief.js) with
 * the rules `classHandRules` hands the character's next fight.
 */
export function handRuleFacts(rules, attrId) {
  const rows = [['starting', 'Opening hand'], ...(rules.drawMode === 'fill' ? [] : [['turn', 'Turn draw']]), ['capacity', 'Hand capacity']];
  return rows
    .filter(([group]) => rules[group]?.statEnabled && rules[group].stat === attrId)
    .map(([group, label]) => ({ label, points: rules[group].pointsPerCard, baseline: rules[group].baseline, maximum: rules[group].maximum }));
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
