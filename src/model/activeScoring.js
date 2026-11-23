// src/model/activeScoring.js — runtime scoring configuration resolver with optional localStorage override.
//
// Pure and headless: safe in Node and browsers. When a player or designer uploads a custom scoring.json
// in Settings (stored under localStorage['ashenspire:customScoring']), getActiveScoring() returns it;
// otherwise it returns the shipped scoring table from src/content/generated/scoring.js.

import { scoring as shippedScoring } from '../content/generated/scoring.js';

export const CUSTOM_SCORING_STORAGE_KEY = 'ashenspire:customScoring';

const REQUIRED_SECTIONS = ['model', 'costs', 'effects', 'statuses', 'keywords', 'rank', 'rarity', 'tags'];

let cachedOverride = null;
let loadedFromStorage = false;

/** Validate a scoring JSON object; returns an array of error messages (empty when valid). */
export function validateScoringConfig(obj) {
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

function readStorageOverride() {
  if (loadedFromStorage) return cachedOverride;
  loadedFromStorage = true;
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const raw = ls.getItem(CUSTOM_SCORING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (validateScoringConfig(parsed).length === 0) {
      cachedOverride = parsed;
      return cachedOverride;
    }
  } catch { /* ignore malformed storage */ }
  return null;
}

/** Return the active scoring table (custom override if loaded, else shipped scoring). */
export function getActiveScoring() {
  return readStorageOverride() || shippedScoring;
}

/** Whether a custom scoring configuration is currently active. */
export function hasCustomScoring() {
  return Boolean(readStorageOverride());
}

/** Validate and activate a custom scoring JSON object (persisted in localStorage when available). */
export function setCustomScoring(obj) {
  const errors = validateScoringConfig(obj);
  if (errors.length) return { ok: false, errors };
  cachedOverride = structuredClone(obj);
  loadedFromStorage = true;
  try {
    globalThis.localStorage?.setItem(CUSTOM_SCORING_STORAGE_KEY, JSON.stringify(cachedOverride));
  } catch { /* quota or unavailable storage */ }
  return { ok: true, errors: [] };
}

/** Clear any custom scoring override and revert to the shipped table. */
export function clearCustomScoring() {
  cachedOverride = null;
  loadedFromStorage = true;
  try {
    globalThis.localStorage?.removeItem(CUSTOM_SCORING_STORAGE_KEY);
  } catch { /* ignore */ }
  return { ok: true };
}
