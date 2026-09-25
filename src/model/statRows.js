// src/model/statRows.js — which stat rows a run, a fight or a preview reads.
//
// Ruleset 7 (owner, 2026-09-24: "I'd like all features, handsize, draw amount,
// actions, ar, dr, pr, ward, poise, stamina, mana, hp settings to have a
// similiar interface and be driven by only that interface") put every stat in
// the derived-stat table: one row shape, priced by `statRowValue`
// (model/derivedStats.js). This module answers ONE question for every reader —
// "which rows?" — so no consumer keeps a second home for a stat:
//
//   a run born under ruleset 7 or later   its own snapshot's rows
//   a run born under ruleset 1–6          its snapshot's pool rows, plus the
//                                         RETIRED homes it was priced by,
//                                         restated as rows with carriers so
//                                         the arithmetic is exact
//   no run (creation, a fixture)          the live table
//
// The retired homes — the rating formula (`ratings.<id>` + one global
// `multiplier`), the hand rules' single-stat groups and `balance.handMax` —
// live on here ONLY as frozen legacy numbers and adapters. Nothing authors
// them any more, and the settings keys that set them convert on import
// (`migrateLegacyStatSettings`) into the rows' own keys.

import { HAND_STAT_IDS, RATING_STAT_IDS, classRuleRow, isStatRowRuleset, resolvedRuleRow, statRowValue } from './derivedStats.js';

export const STAT_ROW_ATTRIBUTE_IDS = Object.freeze(['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence']);
export const STAT_ROW_FIELDS = Object.freeze(['base', ...STAT_ROW_ATTRIBUTE_IDS, 'perLevel', 'min', 'max']);
export const STAT_ROW_KEY_PREFIX = 'gameConfig.derivedStatRules.rules.';
/** A class's own row: `gameConfig.derivedStatRules.byClass.<class>.<row>.<field>`. */
export const STAT_ROW_CLASS_KEY_PREFIX = 'gameConfig.derivedStatRules.byClass.';
/** The Max a settings row opens on when the row has none: it means no ceiling, not a cap at 999. */
export const STAT_ROW_NO_MAX = 999;

// ---- THE FROZEN RULESET-6 NUMBERS ------------------------------------------
//
// What a run born before ruleset 7 was priced by, exactly as they shipped. A
// retune of the live rows never reaches them: that is what "runs snapshot
// rules at birth" means for the two homes that were never snapshotted.
const legacyRule = (weights, base = 0) => Object.freeze({ base, ...Object.fromEntries(STAT_ROW_ATTRIBUTE_IDS.map((id) => [id, weights[id] || 0])) });
export const LEGACY_RATING_FORMULA = Object.freeze({
  multiplier: 1,
  ratings: Object.freeze({
    ar: legacyRule({ strength: 0.75, dexterity: 0.5, constitution: 0.25, wisdom: 0.25, intelligence: 0.25 }),
    dr: legacyRule({ strength: 0.5, dexterity: 0.75, constitution: 0.25, wisdom: 0.35, intelligence: 0.15 }),
    pr: legacyRule({ dexterity: 0.25, constitution: 0.5, wisdom: 0.5, intelligence: 0.75 }),
    poise: legacyRule({ constitution: 1, strength: 0.5, wisdom: 0.2, intelligence: 0.1 }, 1),
    ward: legacyRule({ dexterity: 0.2, constitution: 0.3, wisdom: 1, intelligence: 0.5 }, 1),
  }),
});
export const LEGACY_HAND_GROUPS = Object.freeze({
  // The opening hand as #1294 shipped it (owner, 2026-09-24: "start with 4-6
  // cards depending on the base (3-5)"): 4–6, each class on its own base and
  // attribute (LEGACY_STARTING_BY_CLASS). Every pre-ruleset-7 run read its hand
  // rules live at each fight, so this is what they all deal now.
  starting: Object.freeze({ base: 4, statEnabled: true, stat: 'intelligence', baseline: 1, pointsPerCard: 2, minimum: 4, maximum: 6 }),
  turn: Object.freeze({ base: 2, statEnabled: true, stat: 'intelligence', baseline: 4, pointsPerCard: 5, minimum: 2, maximum: 10 }),
  capacity: Object.freeze({ base: 7, statEnabled: true, stat: 'intelligence', baseline: 1, pointsPerCard: 5, minimum: 1, maximum: 30 }),
});
/** #1294's per-class opening hand: each row replaces `starting.base` and `starting.stat`. */
export const LEGACY_STARTING_BY_CLASS = Object.freeze({
  reaver: Object.freeze({ base: 3, stat: 'strength' }),
  rogue: Object.freeze({ base: 4, stat: 'dexterity' }),
  herald: Object.freeze({ base: 4, stat: 'wisdom' }),
  starseer: Object.freeze({ base: 5, stat: 'intelligence' }),
});
/** `balance.handMax` as it shipped: a co-op fight's hand size before ruleset 7. */
export const LEGACY_HAND_MAX = 5;
/** Hand-rule group → the ruleset-7 row that replaced it. */
export const HAND_GROUP_ROWS = Object.freeze({ starting: 'openingHand', turn: 'draw', capacity: 'handSize' });
const HAND_GROUP_FIELDS = ['base', 'statEnabled', 'stat', 'baseline', 'pointsPerCard', 'minimum', 'maximum'];

// ---- ADAPTERS: A RETIRED HOME, RESTATED AS ONE ROW -------------------------

/** True for a hand-rule group in the retired single-stat shape. */
export function isLegacyHandGroup(group) {
  return !!group && typeof group === 'object' && Object.hasOwn(group, 'pointsPerCard');
}

/**
 * legacyHandRow(group) → the row `statRowValue` prices exactly as
 * `base + floor(max(0, attribute − baseline) ÷ pointsPerCard)`, clamped.
 */
export function legacyHandRow(group) {
  return {
    base: group.base,
    ...(group.statEnabled ? { [group.stat]: 1, pointsBaseline: group.baseline, pointsPerIncrease: group.pointsPerCard, rounding: 'floor' } : {}),
    min: group.minimum,
    max: group.maximum,
  };
}

/**
 * legacyRatingRow(rule, multiplier) → the row `statRowValue` prices exactly as
 * `base + floor(Σ floor(attribute × weight) × multiplier)`.
 */
export function legacyRatingRow(rule, multiplier = 1) {
  return { ...rule, ...(Number.isFinite(multiplier) && multiplier !== 1 ? { multiplier } : {}) };
}

/** The legacy rating formula a (pre-ruleset-7) configuration states, frozen defaults under it. */
export function legacyRatingFormulaFromSettings(settings = {}) {
  const formula = structuredClone(LEGACY_RATING_FORMULA);
  const multiplier = Number(settings['gameConfig.combatRatings.multiplier']);
  if (Number.isFinite(multiplier) && multiplier >= 0) formula.multiplier = multiplier;
  for (const id of RATING_STAT_IDS) {
    for (const field of ['base', ...STAT_ROW_ATTRIBUTE_IDS]) {
      const value = Number(settings[`gameConfig.combatRatings.ratings.${id}.${field}`]);
      if (Number.isFinite(value) && value >= 0) formula.ratings[id][field] = value;
    }
  }
  return formula;
}

/**
 * The legacy hand-rule groups a (pre-ruleset-7) configuration states, frozen
 * defaults under them, with the class's own opening hand (#1294) folded into
 * `starting` when a class is named.
 */
export function legacyHandGroupsFromSettings(settings = {}, classId = null) {
  const groups = structuredClone(LEGACY_HAND_GROUPS);
  settings = Object.fromEntries(withoutRetiredOpeningLimits(Object.entries(settings || {})));
  for (const [group, rule] of Object.entries(groups)) {
    for (const field of HAND_GROUP_FIELDS) {
      const raw = settings[`gameConfig.handRules.${group}.${field}`];
      if (raw === undefined) continue;
      if (field === 'statEnabled') { if (typeof raw === 'boolean') rule[field] = raw; continue; }
      if (field === 'stat') { if (STAT_ROW_ATTRIBUTE_IDS.includes(raw)) rule[field] = raw; continue; }
      const value = Math.floor(Number(raw));
      const floor = field === 'pointsPerCard' || (group === 'capacity' && ['base', 'minimum', 'maximum'].includes(field)) ? 1 : 0;
      if (Number.isFinite(value)) rule[field] = Math.min(99, Math.max(floor, value));
    }
    if (rule.minimum > rule.maximum) groups[group] = structuredClone(LEGACY_HAND_GROUPS[group]);
  }
  const own = classId ? { ...LEGACY_STARTING_BY_CLASS[classId] } : null;
  if (own && LEGACY_STARTING_BY_CLASS[classId]) {
    const base = Math.floor(Number(settings[`gameConfig.handRules.startingByClass.${classId}.base`]));
    if (Number.isFinite(base)) own.base = Math.min(99, Math.max(0, base));
    const stat = settings[`gameConfig.handRules.startingByClass.${classId}.stat`];
    if (STAT_ROW_ATTRIBUTE_IDS.includes(stat)) own.stat = stat;
    groups.starting = { ...groups.starting, base: own.base, stat: own.stat };
  }
  return groups;
}

// THE OPENING-HAND LIMITS BEFORE 2026-09-24 WERE 3–15 (owner, 2026-09-24:
// "start with 4-6 cards", #1294). A stored or imported `starting.maximum` of
// exactly 15 is that retired default and is DROPPED with a warning, with the
// `starting.minimum` of 3 riding beside it; a lone minimum of 3 is somebody's
// choice and stays. Read before any retired hand key is restated as a row.
const OPENING_MAXIMUM_KEY = 'gameConfig.handRules.starting.maximum';
const OPENING_MINIMUM_KEY = 'gameConfig.handRules.starting.minimum';
const bareKey = (key) => (key.startsWith('settings.') ? key.slice('settings.'.length) : key);

/** True when a stored profile pins the retired opening-hand cap of 15. */
export function hasRetiredOpeningLimits(settings = {}) {
  return settings?.[OPENING_MAXIMUM_KEY] === 15;
}

/** withoutRetiredOpeningLimits(entries, warnings) → entries without the retired 3–15 opening-hand limits. */
export function withoutRetiredOpeningLimits(entries, warnings = null) {
  const retiredMaximum = ([key, value]) => bareKey(key) === OPENING_MAXIMUM_KEY && value === 15;
  if (!entries.some(retiredMaximum)) return entries;
  const retiredMinimum = ([key, value]) => bareKey(key) === OPENING_MINIMUM_KEY && value === 3;
  const dropsMinimum = entries.some(retiredMinimum);
  if (Array.isArray(warnings)) {
    warnings.push(`Opening hand: the old limit${dropsMinimum ? 's of 3–15 cards were' : ' of 15 cards was'} left out, so the current ${LEGACY_HAND_GROUPS.starting.minimum}–${LEGACY_HAND_GROUPS.starting.maximum} applies. Everything else was kept.`);
  }
  return entries.filter((entry) => !retiredMaximum(entry) && !retiredMinimum(entry));
}

// ---- WHICH ROWS -------------------------------------------------------------

function snapshotTable(run) {
  const snapshot = run && run.derivedStatRuleSnapshot;
  return snapshot && snapshot.rules && snapshot.rules.rules ? snapshot.rules : null;
}

/** True when this run (or fight) was born before ruleset 7 and reads the retired homes. */
export function readsLegacyStatHomes(run) {
  const table = snapshotTable(run);
  return !!table && !isStatRowRuleset(table.rulesetVersion);
}

/**
 * statRow(registries, run, id, { settings }) → the row this run reads for `id`.
 *
 * `settings` are the per-fight settings (for a legacy run's hand rules, which
 * were read per fight and never snapshotted).
 */
export function statRow(registries, run, id, { settings = {} } = {}) {
  const table = snapshotTable(run);
  if (table && isStatRowRuleset(table.rulesetVersion)) return resolvedRuleRow(table, id);
  if (table) {
    if (RATING_STAT_IDS.includes(id)) {
      const formula = registries?.balance?.combatRatings?.legacyRatings || LEGACY_RATING_FORMULA;
      return legacyRatingRow(formula.ratings[id], formula.multiplier);
    }
    if (HAND_STAT_IDS.includes(id)) {
      const group = Object.keys(HAND_GROUP_ROWS).find((key) => HAND_GROUP_ROWS[key] === id);
      // THE RUN'S OWN CONFIGURATION SNAPSHOT holds the hand-rule keys it was
      // born with; the live profile has had them converted into row keys
      // (migrateLegacyStatSettings), so reading only it would reset a tuned
      // hand to the shipped groups.
      const own = run?.advancedConfigSnapshot?.overrides || {};
      return legacyHandRow(legacyHandGroupsFromSettings({ ...(settings || {}), ...own }, run?.class || null)[group]);
    }
    return resolvedRuleRow(table, id);
  }
  // No run yet (creation, a preview, a fixture): the live table, and for a
  // named class its own row where the table has one (the opening hand, #1294).
  return classRuleRow(registries?.derivedStatRules, run?.class || null, id);
}

/** The three hand rows a fight reads, keyed by row id. */
export function handStatRows(registries, run, { settings = {} } = {}) {
  return Object.fromEntries(HAND_STAT_IDS.map((id) => [id, statRow(registries, run, id, { settings })]));
}

/** The five rating rows, keyed by rating id. */
export function ratingStatRows(registries, run) {
  return Object.fromEntries(RATING_STAT_IDS.map((id) => [id, statRow(registries, run, id)]));
}

/**
 * ratingsConfigFor(registries, run) → the combat-rating rules with THIS run's
 * rating rows in `ratings`. Every rating reader (combat, the sheet, the
 * equipment receipts, the creation brief) is handed this, so one run's AR is
 * one number wherever it is shown.
 */
export function ratingsConfigFor(registries, run, config = registries?.balance?.combatRatings) {
  if (!config) return config;
  const { multiplier, legacyRatings, ...rest } = config;
  return { ...rest, ratings: ratingStatRows(registries, run) };
}

/** A row's value for one character — the reader every hand and rating surface uses. */
export function statRowCount(row, attributes, level) {
  return statRowValue(row, { attributes, level, lenientAttributes: true }).value;
}

// ---- LEGACY SETTINGS KEYS → ROW KEYS ---------------------------------------
//
// An exported configuration or a stored profile from before ruleset 7 carries
// the retired keys. They are converted, never dropped and never refused, the
// way `rewardMultiplier` became `cinderMultiplier` (model/advancedConfig.js):
//
//   combatRatings.ratings.<id>.<field>   → derivedStatRules.rules.<id>.<field>
//   combatRatings.multiplier             → folded into the five rating rows'
//                                          weights (said in a warning when ≠ 1)
//   handRules.<group>.base/minimum/maximum
//   handRules.<group>.statEnabled/stat/baseline/pointsPerCard
//                                        → the row's base, weights, min and max
//                                          (fitted; said in a warning when the
//                                          group was tuned)
//   balance.handMax                      → dropped: the handSize row replaced it
const LEGACY_RATING_KEY = /^gameConfig\.combatRatings\.(?:multiplier|ratings\.(ar|dr|pr|poise|ward)\.(base|strength|dexterity|constitution|wisdom|intelligence))$/;
const LEGACY_HAND_KEY = /^gameConfig\.handRules\.(?:(starting|turn|capacity)\.(base|statEnabled|stat|baseline|pointsPerCard|minimum|maximum)|startingByClass\.[A-Za-z]+\.(base|stat))$/;
const LEGACY_HAND_MAX_KEY = 'gameConfig.balance.handMax';
// TWO ROW KEYS CHANGED MEANING IN RULESET 7 without changing spelling: `draw`
// was the draw only co-op and old fights read (solo drew by the hand rules),
// and `poise` was the pool only a ratings-off fight read. A profile or file
// written before ruleset 7 is recognised by the absence of this marker (a
// profile key) or of `statRows: 7` on an exported file, and its values for
// those two rows are read as what they meant then.
export const STAT_ROWS_MARKER = 'statRowsVersion';
export const STAT_ROWS_VERSION = 7;
const LEGACY_MEANING_KEY = /^gameConfig\.derivedStatRules\.rules\.(draw|poise)\./;
/** The row keys whose meaning changed in ruleset 7 (see STAT_ROWS_MARKER). */
export const STAT_ROWS_CHANGED_MEANING = LEGACY_MEANING_KEY;

/** Whether a stored profile still holds a key ruleset 7 retired. */
const isRetiredStatKey = (key) => LEGACY_RATING_KEY.test(key) || LEGACY_HAND_KEY.test(key) || key === LEGACY_HAND_MAX_KEY;

/**
 * An export writes each row's `settings.`-prefixed mirror beside it; a retired
 * key's mirror is read as the key itself (the key wins when both are there).
 */
function withoutRetiredMirrors(settings) {
  const mirrors = Object.keys(settings).filter((key) => key.startsWith('settings.') && isRetiredStatKey(bareKey(key)));
  if (!mirrors.length) return settings;
  const next = { ...settings };
  for (const key of mirrors) {
    if (!Object.hasOwn(next, bareKey(key))) next[bareKey(key)] = next[key];
    delete next[key];
  }
  return next;
}

export function hasLegacyStatSettings(settings = {}) {
  return Object.keys(settings || {}).some((key) => isRetiredStatKey(bareKey(key)))
    || (settings?.[STAT_ROWS_MARKER] !== STAT_ROWS_VERSION && Object.keys(settings || {}).some((key) => LEGACY_MEANING_KEY.test(bareKey(key))));
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * fitHandRow(group) → the ruleset-7 row closest to a tuned legacy group over
 * the attribute values a character can have (1–30), searching whole bases and
 * two-decimal weights. Ties keep the smaller weight.
 */
export function fitHandRow(group) {
  const legacy = legacyHandRow(group);
  const want = (points) => statRowCount(legacy, { [group.stat]: points });
  const fields = { min: group.minimum, max: group.maximum };
  if (!group.statEnabled) return { base: group.base, ...fields };
  let best = null;
  for (let base = Math.max(0, group.base - 10); base <= group.base + 10; base += 1) {
    for (let step = 0; step <= 100; step += 1) {
      const weight = step / 100;
      const row = { base, [group.stat]: weight, ...fields };
      let error = 0;
      for (let points = 1; points <= 30; points += 1) error += Math.abs(statRowCount(row, { [group.stat]: points }) - want(points));
      if (!best || error < best.error) best = { error, row };
    }
  }
  return best.row;
}

/**
 * migrateLegacyStatSettings(settings, warnings) → a NEW settings object with
 * every retired stat key restated as a row key. Unchanged input is returned
 * as is.
 */
export function migrateLegacyStatSettings(settings = {}, warnings = null, { legacyRows = settings?.[STAT_ROWS_MARKER] !== STAT_ROWS_VERSION } = {}) {
  if (!hasLegacyStatSettings(settings)) return settings;
  settings = withoutRetiredMirrors(settings);
  const next = { ...settings };
  // Written before ruleset 7: the old `draw` and `poise` rows go first, so the
  // converted hand and rating values below are what those rows now hold.
  if (legacyRows) {
    const ratingsOff = settings['gameConfig.combatRatings.enabled'] === false;
    const dropped = Object.keys(settings).filter((key) => LEGACY_MEANING_KEY.test(bareKey(key))
      && (key.includes('.draw.') || !ratingsOff));
    for (const key of dropped) delete next[key];
    if (dropped.length && Array.isArray(warnings)) {
      warnings.push(`${dropped.some((key) => key.includes('.draw.')) ? 'The old Draw row was read only by co-op and older fights; Draw / turn is now every fight\'s turn draw, so the old values were set aside. ' : ''}${dropped.some((key) => key.includes('.poise.')) ? 'The old Poise pool was read only with combat ratings off; Poise is one row now, so its old values were set aside in favour of the Poise rating. ' : ''}Everything else in the file was imported.`);
    }
  }
  const key = (id, field) => `${STAT_ROW_KEY_PREFIX}${id}.${field}`;
  const setIfAbsent = (id, field, value) => { if (!Object.hasOwn(next, key(id, field))) next[key(id, field)] = value; };
  // Ratings: the formula as the file states it, folded into the rows.
  const ratingKeys = Object.keys(settings).filter((k) => LEGACY_RATING_KEY.test(k));
  if (ratingKeys.length) {
    const formula = legacyRatingFormulaFromSettings(settings);
    const scaled = formula.multiplier !== 1;
    for (const id of RATING_STAT_IDS) {
      const stated = ratingKeys.some((k) => k.startsWith(`gameConfig.combatRatings.ratings.${id}.`));
      if (!stated && !scaled) continue;
      // A Poise rating edited while ratings were off never moved a thing, and
      // the one Poise row is live either way: leave it retired (Codex, #1296).
      if (id === 'poise' && settings['gameConfig.combatRatings.enabled'] === false) continue;
      for (const field of ['base', ...STAT_ROW_ATTRIBUTE_IDS]) {
        const own = Object.hasOwn(settings, `gameConfig.combatRatings.ratings.${id}.${field}`);
        if (!own && !scaled) continue;
        const value = field === 'base' ? formula.ratings[id].base : round2(formula.ratings[id][field] * formula.multiplier);
        setIfAbsent(id, field, value);
      }
    }
    for (const k of ratingKeys) delete next[k];
    if (scaled && Array.isArray(warnings)) {
      warnings.push(`The combat-rating multiplier (${formula.multiplier}) was retired: every stat is one row now, so it was folded into the AR, DR, PR, Poise and Ward weights. Each attribute is still rounded down on its own, so a rating can differ by a point from what the multiplier gave. Everything else in the file was imported.`);
    }
  }
  // Hand rules: a group left at its shipped numbers is simply the new row's
  // defaults; a tuned one is fitted and said. The opening hand is per class
  // (#1294), so a tuned opening group is fitted once per class, onto that
  // class's own row.
  const handKeys = Object.keys(settings).filter((k) => LEGACY_HAND_KEY.test(k));
  if (handKeys.length) {
    const kept = Object.fromEntries(withoutRetiredOpeningLimits(Object.entries(settings), warnings));
    const fitted = [];
    const differs = (rule, legacy) => HAND_GROUP_FIELDS.some((field) => rule[field] !== legacy[field]);
    for (const [group, id] of Object.entries(HAND_GROUP_ROWS)) {
      if (group === 'starting') {
        let tuned = false;
        for (const classId of Object.keys(LEGACY_STARTING_BY_CLASS)) {
          const rule = legacyHandGroupsFromSettings(kept, classId).starting;
          const shipped = legacyHandGroupsFromSettings({}, classId).starting;
          if (!differs(rule, shipped)) continue;
          const row = fitHandRow(rule);
          for (const field of ['base', ...STAT_ROW_ATTRIBUTE_IDS, 'min', 'max']) {
            const k = `${STAT_ROW_CLASS_KEY_PREFIX}${classId}.${id}.${field}`;
            if (!Object.hasOwn(next, k)) next[k] = row[field] ?? 0;
          }
          tuned = true;
        }
        if (tuned) fitted.push('opening hand');
        continue;
      }
      if (!handKeys.some((k) => k.startsWith(`gameConfig.handRules.${group}.`))) continue;
      const rule = legacyHandGroupsFromSettings(kept)[group];
      if (!differs(rule, LEGACY_HAND_GROUPS[group])) continue;
      const row = fitHandRow(rule);
      for (const field of ['base', ...STAT_ROW_ATTRIBUTE_IDS, 'min', 'max']) {
        setIfAbsent(id, field, row[field] ?? 0);
      }
      fitted.push(id === 'handSize' ? 'hand size' : 'turn draw');
    }
    for (const k of handKeys) delete next[k];
    if (fitted.length && Array.isArray(warnings)) {
      warnings.push(`The hand rules' "attribute used / points before bonuses / points per card" dials were replaced by attribute weights, like every other stat. Your tuned ${fitted.join(', ')} ${fitted.length === 1 ? 'was' : 'were'} converted to the closest weight row; check Stats → Draw & hand. Everything else in the file was imported.`);
    }
  }
  if (Object.hasOwn(next, LEGACY_HAND_MAX_KEY)) {
    delete next[LEGACY_HAND_MAX_KEY];
    if (Array.isArray(warnings)) warnings.push('The fallback hand capacity was retired: every fight, co-op included, reads Stats → Draw & hand → Hand size. Everything else in the file was imported.');
  }
  return next;
}
