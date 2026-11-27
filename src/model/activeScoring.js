// src/model/activeScoring.js — pure runtime scoring configuration resolver.
//
// Pure and headless (no browser globals): defaults to the shipped scoring table from
// src/content/generated/scoring.js, and supports an explicit in-memory override activated
// by the UI layer (e.g. when the player uploads a custom scoring.json in Settings).

import { scoring as shippedScoring } from '../content/generated/scoring.js';

export const CUSTOM_SCORING_STORAGE_KEY = 'ashenspire:customScoring';

const REQUIRED_SECTIONS = ['model', 'cardModel', 'costs', 'effects', 'statuses', 'keywords', 'rank', 'rarity', 'tags'];

// The parts a card name's length limit may list in naming.card.limit.keep.
export const NAME_LIMIT_PARTS = ['base', 'rank', 'upgrade', 'element', 'effect', 'rarity'];

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
  // A cost, effect or status may carry `multiplier: true` (scores P x weight per unit); absent or false is flat.
  for (const section of ['costs', 'effects', 'statuses']) {
    if (!obj[section] || typeof obj[section] !== 'object') continue;
    for (const [id, entry] of Object.entries(obj[section])) {
      if (id[0] === '$' || !entry || typeof entry !== 'object') continue;
      if ('multiplier' in entry && typeof entry.multiplier !== 'boolean') errors.push(`${section}.${id}.multiplier must be true or false.`);
    }
  }
  // A keyword is flat (adds `flat`) or a multiplier (adds P x `multiplier`); a tag adds `weight` or carries
  // `multiplier` / `pMultiplier`. Either form is valid; a number it has must be finite.
  if (obj.keywords && typeof obj.keywords === 'object') {
    for (const [id, kw] of Object.entries(obj.keywords)) {
      if (id[0] === '$' || !kw || typeof kw !== 'object') continue;
      if (!Number.isFinite(kw.flat) && !Number.isFinite(kw.multiplier)) errors.push(`keywords.${id} needs a finite flat or multiplier.`);
    }
  }
  if (obj.tags && typeof obj.tags === 'object') {
    for (const [id, tag] of Object.entries(obj.tags)) {
      if (id[0] === '$' || !tag || typeof tag !== 'object') continue;
      for (const field of ['weight', 'multiplier', 'pMultiplier']) {
        if (field in tag && !Number.isFinite(tag[field])) errors.push(`tags.${id}.${field} must be a finite number.`);
      }
    }
  }
  if (obj.upgradeTags && typeof obj.upgradeTags === 'object') {
    for (const [id, rule] of Object.entries(obj.upgradeTags)) {
      if (id[0] === '$' || !rule || typeof rule !== 'object') continue;
      for (const field of ['base', 'pMultiplier', 'effectMultPerStack']) {
        if (field in rule && !Number.isFinite(rule[field])) errors.push(`upgradeTags.${id}.${field} must be a finite number.`);
      }
    }
  }
  if (obj.tierUnlocks !== undefined) {
    const tu = obj.tierUnlocks;
    const isPlainObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
    if (!isPlainObj(tu)) {
      errors.push('tierUnlocks must be an object when present.');
    } else {
      if (tu.enabled !== undefined && typeof tu.enabled !== 'boolean') {
        errors.push('tierUnlocks.enabled must be a boolean.');
      }
      if (tu.zeroCostMinTier !== undefined && (!Number.isFinite(tu.zeroCostMinTier) || tu.zeroCostMinTier < 0)) {
        errors.push('tierUnlocks.zeroCostMinTier must be a non-negative number.');
      }
      if (tu.hybridMinTier !== undefined && (!Number.isFinite(tu.hybridMinTier) || tu.hybridMinTier < 0)) {
        errors.push('tierUnlocks.hybridMinTier must be a non-negative number.');
      }
      if (tu.upgradeRarityMinTier !== undefined && (!Array.isArray(tu.upgradeRarityMinTier) || tu.upgradeRarityMinTier.some((v) => !Number.isFinite(v) || v < 0))) {
        errors.push('tierUnlocks.upgradeRarityMinTier must be an array of non-negative numbers.');
      }
      if (tu.rarityBonus !== undefined) {
        if (!isPlainObj(tu.rarityBonus)) errors.push('tierUnlocks.rarityBonus must be an object.');
        else for (const [r, v] of Object.entries(tu.rarityBonus)) {
          if (!Number.isFinite(v) || v < 0) errors.push(`tierUnlocks.rarityBonus.${r} must be a non-negative finite number.`);
        }
      }
      if (tu.upgrades !== undefined) {
        if (!isPlainObj(tu.upgrades)) errors.push('tierUnlocks.upgrades must be an object.');
        else for (const [k, v] of Object.entries(tu.upgrades)) {
          if (!Number.isFinite(v) || v < 0) errors.push(`tierUnlocks.upgrades.${k} must be a non-negative number.`);
        }
      }
      if (tu.elements !== undefined) {
        if (!isPlainObj(tu.elements)) errors.push('tierUnlocks.elements must be an object.');
        else for (const [el, v] of Object.entries(tu.elements)) {
          if (!Number.isFinite(v) || v < 0) errors.push(`tierUnlocks.elements.${el} must be a non-negative number.`);
        }
      }
      if (tu.upgradeTagStacks !== undefined) {
        if (!isPlainObj(tu.upgradeTagStacks)) errors.push('tierUnlocks.upgradeTagStacks must be an object.');
        else for (const [fam, arr] of Object.entries(tu.upgradeTagStacks)) {
          if (!Array.isArray(arr) || arr.some((v) => !Number.isFinite(v) || v < 0)) {
            errors.push(`tierUnlocks.upgradeTagStacks.${fam} must be an array of non-negative numbers.`);
          }
        }
      }
      if (tu.statuses !== undefined) {
        if (!isPlainObj(tu.statuses)) errors.push('tierUnlocks.statuses must be an object.');
        else for (const [st, entry] of Object.entries(tu.statuses)) {
          if (typeof entry === 'number') {
            if (!Number.isFinite(entry) || entry < 0) errors.push(`tierUnlocks.statuses.${st} must be a non-negative number.`);
          } else if (!isPlainObj(entry)) {
            errors.push(`tierUnlocks.statuses.${st} must be a number or object.`);
          } else {
            if (entry.minTier !== undefined && (!Number.isFinite(entry.minTier) || entry.minTier < 0)) errors.push(`tierUnlocks.statuses.${st}.minTier must be a non-negative number.`);
            if (entry.maxStacksBase !== undefined && (!Number.isFinite(entry.maxStacksBase) || entry.maxStacksBase < 1)) errors.push(`tierUnlocks.statuses.${st}.maxStacksBase must be >= 1.`);
            if (entry.stacksPerExtraTier !== undefined && (!Number.isFinite(entry.stacksPerExtraTier) || entry.stacksPerExtraTier < 0)) errors.push(`tierUnlocks.statuses.${st}.stacksPerExtraTier must be a non-negative number.`);
          }
        }
      }
      if (tu.ceilings !== undefined) {
        if (!isPlainObj(tu.ceilings)) errors.push('tierUnlocks.ceilings must be an object.');
        else for (const [kind, arr] of Object.entries(tu.ceilings)) {
          if (!Array.isArray(arr) || arr.some((v) => v !== null && (!Number.isFinite(v) || v < 1))) {
            errors.push(`tierUnlocks.ceilings.${kind} must be an array of positive numbers or null.`);
          }
        }
      }
    }
  }
  // naming.card.limit and naming.item.limit are optional (no block, or no maxChars, = no limit): {maxChars: whole number >= 1, keep: name parts, most important first}.
  for (const kind of ['card', 'item']) {
    const limit = obj.naming?.[kind]?.limit;
    if (limit !== undefined) {
      if (!limit || typeof limit !== 'object' || Array.isArray(limit)) errors.push(`naming.${kind}.limit must be an object.`);
      else {
        if (limit.maxChars !== undefined && (!Number.isInteger(limit.maxChars) || limit.maxChars < 1)) errors.push(`naming.${kind}.limit.maxChars must be a whole number of at least 1.`);
        if (!Array.isArray(limit.keep) || limit.keep.some((part) => !NAME_LIMIT_PARTS.includes(part))) errors.push(`naming.${kind}.limit.keep must list name parts (${NAME_LIMIT_PARTS.join(', ')}).`);
        else if (limit.keep.length === 0 || new Set(limit.keep).size !== limit.keep.length) errors.push(`naming.${kind}.limit.keep must list at least one part, each once.`);
      }
    }
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
