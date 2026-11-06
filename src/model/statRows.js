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
// them any more, and the settings keys that set them are dropped on import
// with a warning (model/advancedConfig.js), never converted.

import { HAND_STAT_IDS, RATING_STAT_IDS, isStatRowRuleset, resolvedRuleRow, rowForClass, statRowValue } from './derivedStats.js';

export const STAT_ROW_ATTRIBUTE_IDS = Object.freeze(['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence']);
export const STAT_ROW_FIELDS = Object.freeze(['base', ...STAT_ROW_ATTRIBUTE_IDS, 'perLevel', 'min', 'max']);
export const STAT_ROW_KEY_PREFIX = 'gameConfig.derivedStatRules.rules.';
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
// THE HAND GROUPS AS #1294 LEFT THEM, which is what dev dealt every run born
// before ruleset 7 by the time this ruleset landed: the opening hand is 4–6
// cards, and each class opens on its own base and primary attribute
// (`startingByClass`) over the shared baseline and points per card. A run
// started between #1294 and ruleset 7 restores exactly that hand; so does an
// older one, which #1294 had already moved onto it.
export const LEGACY_HAND_GROUPS = Object.freeze({
  starting: Object.freeze({ base: 4, statEnabled: true, stat: 'intelligence', baseline: 1, pointsPerCard: 2, minimum: 4, maximum: 6 }),
  turn: Object.freeze({ base: 2, statEnabled: true, stat: 'intelligence', baseline: 4, pointsPerCard: 5, minimum: 2, maximum: 10 }),
  capacity: Object.freeze({ base: 7, statEnabled: true, stat: 'intelligence', baseline: 1, pointsPerCard: 5, minimum: 1, maximum: 30 }),
});
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
 * defaults under them. With a `classId`, the opening hand is that class's
 * (#1294's `startingByClass`), exactly as `handRulesForClass` resolved it.
 */
export function legacyHandGroupsFromSettings(settings = {}, classId = null) {
  settings = Object.fromEntries(withoutRetiredOpeningHand(Object.entries(settings || {})));
  const groups = structuredClone(LEGACY_HAND_GROUPS);
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
  const byClass = legacyStartingByClassFromSettings(settings);
  if (classId && byClass[classId]) groups.starting = { ...groups.starting, ...byClass[classId] };
  return groups;
}

/** #1294's per-class opening-hand rows a (pre-ruleset-7) configuration states, frozen defaults under them. */
export function legacyStartingByClassFromSettings(settings = {}) {
  const byClass = structuredClone(LEGACY_STARTING_BY_CLASS);
  for (const [classId, row] of Object.entries(byClass)) {
    const base = Math.floor(Number(settings[`gameConfig.handRules.startingByClass.${classId}.base`]));
    if (Number.isFinite(base)) row.base = Math.min(99, Math.max(0, base));
    const stat = settings[`gameConfig.handRules.startingByClass.${classId}.stat`];
    if (STAT_ROW_ATTRIBUTE_IDS.includes(stat)) row.stat = stat;
  }
  return byClass;
}

// THE OPENING-HAND LIMITS BEFORE #1294 WERE 3–15 (owner, 2026-09-24: "start
// with 4-6 cards"). The Advanced panel stores — and an export writes — every
// value it holds, so a profile or file from before that change pins the old
// default cap of 15. A stored or imported `starting.maximum` of exactly 15 is
// that retired default, so it is DROPPED with a warning and the current
// default applies; the `starting.minimum` of 3 riding beside it is the other
// half of the same pair and goes with it. A lone minimum of 3 is somebody's
// choice and stays. Run snapshots keep their limits: a run keeps the hand it
// was born with.
//
// THE SHARED OPENING BASE AND ATTRIBUTE ARE RETIRED TOO (owner, 2026-09-24:
// every class opens on its own — Reaver 3 STR, Rogue 4 DEX, Herald 4 WIS,
// Starseer 5 INT; #1318). `starting.base` / `.stat` used to be accepted and
// then overwritten by every class's own row, so an imported customisation
// "succeeded" and the next fight ignored it (Codex, #1294). They are DROPPED
// at every entrance — profile, run snapshot and imported file, in either
// spelling — never converted onto the opening-hand row or copied onto every
// class, which would flatten the four openings into one. The warning is said
// only when the value was not a stock one (base 3 or 4, attribute INT): an
// export writes every value, and a stock value was never a customisation.
// Both drops share ONE warning. (Moved here from model/handRules.js with the
// hand groups; #1318's `withoutRetiredOpeningHand`.)
const OPENING_MAXIMUM_KEY = 'gameConfig.handRules.starting.maximum';
const OPENING_MINIMUM_KEY = 'gameConfig.handRules.starting.minimum';
const RETIRED_OPENING_MAXIMUM = 15;
const RETIRED_OPENING_MINIMUM = 3;
/** The shared opening-hand fields every class sets for itself: no setting reaches them. */
export const RETIRED_SHARED_OPENING_FIELDS = Object.freeze(['base', 'stat']);
const SHARED_OPENING_KEYS = Object.freeze(RETIRED_SHARED_OPENING_FIELDS.map((field) => `gameConfig.handRules.starting.${field}`));
const STOCK_SHARED_OPENING_BASES = Object.freeze([3, 4]);
const bareKey = (key) => (key.startsWith('settings.') ? key.slice('settings.'.length) : key);
const sharedOpening = ([key]) => SHARED_OPENING_KEYS.includes(bareKey(key));
const stockSharedOpening = ([key, value]) => (bareKey(key).endsWith('.base')
  ? STOCK_SHARED_OPENING_BASES.includes(Number(value))
  : String(value) === 'intelligence');

/**
 * True when a stored profile pins the retired opening-hand cap of 15, or holds
 * the retired shared opening base or attribute — each in either spelling.
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
      said.push(`the old limit${dropsMinimum ? 's of 3–15 cards were' : ' of 15 cards was'} left out, so the current opening-hand limits apply`);
    }
    if (shared.some((entry) => !stockSharedOpening(entry))) {
      said.push('the shared base cards and attribute are retired and were left out: each class opens on its own. Use Stats → Draw & hand → each class\'s Opening hand base and attribute weights');
    }
    if (said.length) warnings.push(`Opening hand: ${said.join('; ')}. Everything else was kept.`);
  }
  return entries.filter((entry) => !sharedOpening(entry) && !(dropsLimits && (retiredMaximum(entry) || retiredMinimum(entry))));
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
  // The class a row with a per-class form is read for (a run's `class`, a
  // co-op seat's `classId`); a run's own snapshot already holds its class's row.
  const classId = run?.class ?? run?.classId ?? null;
  if (table && isStatRowRuleset(table.rulesetVersion)) return resolvedRuleRow(table, id, classId);
  if (table) {
    if (RATING_STAT_IDS.includes(id)) {
      const formula = registries?.balance?.combatRatings?.legacyRatings || LEGACY_RATING_FORMULA;
      return legacyRatingRow(formula.ratings[id], formula.multiplier);
    }
    if (HAND_STAT_IDS.includes(id)) {
      const group = Object.keys(HAND_GROUP_ROWS).find((key) => HAND_GROUP_ROWS[key] === id);
      // THE RUN'S OWN CONFIGURATION SNAPSHOT holds the hand-rule keys it was
      // born with; the live profile has had them dropped on import
      // (never converted), so reading only it would reset a tuned
      // hand to the shipped groups.
      const own = run?.advancedConfigSnapshot?.overrides || {};
      return legacyHandRow(legacyHandGroupsFromSettings({ ...(settings || {}), ...own }, classId)[group]);
    }
    return resolvedRuleRow(table, id, classId);
  }
  return resolvedRuleRow(registries?.derivedStatRules, id, classId);
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
