// src/model/activeScoring.js — pure runtime scoring configuration resolver.
//
// Pure and headless (no browser globals): defaults to the shipped scoring table from
// src/content/generated/scoring.js, and supports an explicit in-memory override activated
// by the UI layer (e.g. when the player uploads a custom scoring.json in Settings).

import { scoring as shippedScoring } from '../content/generated/scoring.js';

export const CUSTOM_SCORING_STORAGE_KEY = 'ashenspire:customScoring';

const REQUIRED_SECTIONS = ['model', 'cardModel', 'costs', 'effects', 'statuses', 'keywords', 'rank', 'rarity', 'tags'];

let activeOverride = null;

/** Validate a scoring JSON object; returns an array of error messages (empty when valid). */
export function ValidateScoringConfig(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return ['Scoring configuration must be a JSON object.'];
  }
  for (const key of REQUIRED_SECTIONS) {
    if (!obj[key] || typeof obj[key] !== 'object' || Array.isArray(obj[key])) {
      errors.push(`Missing or invalid required section "${key}".`);
    }
  }
  if (obj.rank && typeof obj.rank === 'object') {
    if (!Number.isFinite(obj.rank.width) || obj.rank.width <= 0) errors.push('rank.width must be a positive number.');
    if (!Number.isInteger(obj.rank.maxRank) || obj.rank.maxRank < 1) errors.push('rank.maxRank must be an integer >= 1.');
    if (!Number.isFinite(obj.rank.unrankedMax)) errors.push('rank.unrankedMax must be a finite number.');
  }
  if (obj.costs && typeof obj.costs === 'object') {
    if (!Number.isFinite(obj.costs.sp?.weight)) errors.push('costs.sp.weight must be a finite number.');
    if (!Number.isFinite(obj.costs.mp?.weight)) errors.push('costs.mp.weight must be a finite number.');
  }
  return errors;
}

/** Return the active scoring table (custom override if active, else shipped scoring). */
export function GetActiveScoring() {
  return activeOverride || shippedScoring;
}

/** Whether a custom scoring configuration is currently active. */
export function HasCustomScoring() {
  return Boolean(activeOverride);
}

/** Validate and activate a custom scoring JSON object in memory. */
export function SetCustomScoring(obj) {
  const errors = ValidateScoringConfig(obj);
  if (errors.length) return { ok: false, errors };
  activeOverride = structuredClone(obj);
  return { ok: true, errors: [] };
}

/** Clear any custom scoring override and revert to the shipped table. */
export function ClearCustomScoring() {
  activeOverride = null;
  return { ok: true };
}
