// src/model/statRows.js — which stat rows a run, a fight or a preview reads.
//
// Ruleset 7 (owner, 2026-09-24: "I'd like all features, handsize, draw amount,
// actions, ar, dr, pr, ward, poise, stamina, mana, hp settings to have a
// similiar interface and be driven by only that interface") put every stat in
// the derived-stat table: one row shape, priced by `statRowValue`
// (model/derivedStats.js). This module answers ONE question for every reader —
// "which rows?" — so no consumer keeps a second home for a stat:
//
//   a run (or fight) with a snapshot   its own snapshot's rows
//   no run (creation, a fixture)       the live table
//
// Core 2 is the only game: a run born before ruleset 7 is refused, never read
// through a restated rating formula or hand group. The settings keys that set
// those retired homes are dropped on import with a warning
// (model/advancedConfig.js), never converted.

import { HAND_STAT_IDS, RATING_STAT_IDS, resolvedRuleRow, statRowValue } from './derivedStats.js';

export const STAT_ROW_ATTRIBUTE_IDS = Object.freeze(['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence']);
export const STAT_ROW_FIELDS = Object.freeze(['base', ...STAT_ROW_ATTRIBUTE_IDS, 'perLevel', 'min', 'max']);
export const STAT_ROW_KEY_PREFIX = 'gameConfig.derivedStatRules.rules.';
/** The Max a settings row opens on when the row has none: it means no ceiling, not a cap at 999. */
export const STAT_ROW_NO_MAX = 999;

/** The hand size a run-context fight with no hand rules deals to (actions.js, combat.js). */
export const FALLBACK_HAND_MAX = 5;
/** Hand-rule group → the ruleset-7 row that replaced it. */
export const HAND_GROUP_ROWS = Object.freeze({ starting: 'openingHand', turn: 'draw', capacity: 'handSize' });

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
  if (table) return resolvedRuleRow(table, id, classId);
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
  const { multiplier, ...rest } = config;
  return { ...rest, ratings: ratingStatRows(registries, run) };
}

/** A row's value for one character — the reader every hand and rating surface uses. */
export function statRowCount(row, attributes, level) {
  return statRowValue(row, { attributes, level, lenientAttributes: true }).value;
}
